const socket = io();

let myId = null;
let myName = '';
let myRoom = '';
let myRackIdx = -1;
let gameState = null;
let pendingPlacements = [];

const BONUS_BOARD = [
  ["TW","","","","TL","","","","TW","","","","TL","","","TW"],
  ["","DW","","","","","","DL","","DL","","","","DW",""],
  ["","","DW","","","TL","","","","TL","","","DW","",""],
  ["","","","DW","","","DL","","DL","","","DW","","",""],
  ["TL","","","","DW","","","","DW","","","","","TL"],
  ["","","TL","","","TL","","","","TL","","","TL","",""],
  ["","","","DL","","","DL","","DL","","","DL","","",""],
  ["TW","","","","DW","","CENTER","","DW","","","","TW",""],
  ["","","","DL","","","DL","","DL","","","DL","","",""],
  ["","","TL","","","TL","","","","TL","","","TL","",""],
  ["TL","","","","DW","","","","DW","","","","","TL"],
  ["","","","DW","","","DL","","DL","","","DW","","",""],
  ["","","DW","","","TL","","","","TL","","","DW","",""],
  ["","DW","","","","","","DL","","DL","","","","DW",""],
  ["TW","","","","TL","","","","TW","","","","TL","","","TW"]
];

function getPersistentId() {
  let persistentId = localStorage.getItem('scrabblePID');
  if (!persistentId) {
    persistentId = Math.random().toString(36).substr(2);
    localStorage.setItem('scrabblePID', persistentId);
  }
  return persistentId;
}

function joinGame() {
  myName = document.getElementById('nickname').value || ('Player' + Math.floor(Math.random()*1000));
  myRoom = document.getElementById('room').value || 'default';
  let persistentId = getPersistentId();
  document.getElementById('conn-status').textContent = "Joining room...";
  socket.emit('join', {room: myRoom, name: myName, persistentId});
}

document.getElementById('joinBtn').onclick = joinGame;

socket.on('join_ok', ({id, rackIdx}) => {
  myId = id;
  myRackIdx = rackIdx;
  document.getElementById('conn-status').textContent = "Connected. Waiting for game...";
});

socket.on('game_update', state => {
  gameState = state;
  document.getElementById('connection-area').style.display = 'none';
  document.getElementById('game').style.display = '';
  pendingPlacements = [];
  renderGame();
});

socket.on('move_result', ({ok, msg}) => {
  if (!ok) alert(msg);
});

function sendMove() {
  socket.emit('play_tiles', {
    placements: pendingPlacements,
    room: myRoom
  });
}

function sendSkipTurn() {
  socket.emit('skip_turn', { room: myRoom });
}

function renderGame() {
  const boardDiv = document.getElementById('board');
  boardDiv.innerHTML = "";
  for (let row = 0; row < 15; row++) {
    for (let col = 0; col < 15; col++) {
      let cell = document.createElement('div');
      cell.className = 'square';
      const bonus = BONUS_BOARD[row][col];
      if      (bonus === "TW") cell.classList.add("tw");
      else if (bonus === "DW") cell.classList.add("dw");
      else if (bonus === "TL") cell.classList.add("tl");
      else if (bonus === "DL") cell.classList.add("dl");
      else if (bonus === "CENTER") cell.classList.add("center");
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.setAttribute("data-empty","true");

      if (gameState.board[row][col]) {
        cell.textContent = gameState.board[row][col];
        cell.removeAttribute("data-empty");
      }
      const pendingTile = pendingPlacements.find(p=>p.row==row&&p.col==col);
      if (pendingTile) {
        cell.textContent = pendingTile.letter;
        cell.removeAttribute("data-empty");
      }
      if (gameState.turnIdx === myRackIdx &&
          !pendingTile && !gameState.board[row][col]) {
        cell.ondragover = (e) => { e.preventDefault(); cell.style.background = "#eccc68"; };
        cell.ondragleave = (e) => { e.preventDefault(); cell.style.background = ''; };
        cell.ondrop = (e) => handleBoardDrop(e, row, col, cell);
      }
      if (pendingTile && gameState.turnIdx === myRackIdx) {
        cell.draggable = true;
        cell.style.cursor = 'grab';
        cell.ondragstart = (e) => handlePendingTileDragStart(e, pendingTile, row, col);
      }
      boardDiv.appendChild(cell);
    }
  }

  const playersDiv = document.getElementById('players');
  playersDiv.innerHTML = "";
  (gameState.players || []).forEach((player, idx) => {
    let card = document.createElement('div');
    card.className = 'player-card';
    card.innerHTML = `<strong>${player.name}${idx === gameState.turnIdx ? " (Your turn)" : ""}</strong><br>Score: <span>${player.score||0}</span>`;
    let rackDiv = document.createElement('div');
    rackDiv.className = 'rack';
    if (idx === myRackIdx) {
      player.rack.forEach((letter, tIdx) => {
        if (pendingPlacements.some(p => p.rackIdx === tIdx)) return;
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.textContent = letter;
        tile.draggable = true;
        tile.dataset.letter = letter;
        tile.dataset.rackIdx = tIdx;
        tile.ondragstart = (e) => handleTileDragStart(e, letter, tIdx);
        rackDiv.appendChild(tile);
      });
      rackDiv.ondragover = (e) => { e.preventDefault(); rackDiv.style.background = "#eccc68"; };
      rackDiv.ondragleave = () => rackDiv.style.background = "";
      rackDiv.ondrop = (e) => handleRackDrop(e, rackDiv);
    } else {
      for (let i=0; i<player.rack.length;i++) {
        const tile = document.createElement('div');
        tile.className = 'tile hidden';
        tile.textContent = '•';
        rackDiv.appendChild(tile);
      }
    }
    card.appendChild(rackDiv);
    playersDiv.appendChild(card);
  });

  const actions = document.getElementById('actions');
  actions.innerHTML = "";
  if (gameState.turnIdx === myRackIdx) {
    let scoreObj = calculateWordScore(gameState.board, pendingPlacements);

    let scoreSpan = document.createElement('span');
    scoreSpan.id = "scorePreview";
    scoreSpan.style.marginRight = "18px";
    if (pendingPlacements.length > 0) {
      let cwStr = scoreObj.crossWords && scoreObj.crossWords.length
        ? ` + Cross: ${scoreObj.crossScores}` : '';
      scoreSpan.textContent =
        `Score: ${scoreObj.mainScore}${cwStr} → Turn Total: ${scoreObj.total}`;
    } else {
      scoreSpan.textContent = '';
    }
    actions.appendChild(scoreSpan);

    let playBtn = document.createElement('button');
    playBtn.textContent = "Submit Move";
    playBtn.onclick = sendMove;
    playBtn.disabled = pendingPlacements.length === 0;
    actions.appendChild(playBtn);

    let cancelBtn = document.createElement('button');
    cancelBtn.textContent = "Clear Move";
    cancelBtn.onclick = () => { pendingPlacements = []; renderGame(); };
    actions.appendChild(cancelBtn);

    let skipBtn = document.createElement('button');
    skipBtn.textContent = "Skip Turn";
    skipBtn.onclick = sendSkipTurn;
    actions.appendChild(skipBtn);
  }
}

function handleTileDragStart(e, letter, rackIdx) {
  e.dataTransfer.setData("type", "rack");
  e.dataTransfer.setData("letter", letter);
  e.dataTransfer.setData("rackIdx", rackIdx);
}

function handlePendingTileDragStart(e, pendingTile, fromRow, fromCol) {
  e.dataTransfer.setData("type", "pending");
  e.dataTransfer.setData("letter", pendingTile.letter);
  e.dataTransfer.setData("rackIdx", pendingTile.rackIdx);
  e.dataTransfer.setData("fromRow", fromRow);
  e.dataTransfer.setData("fromCol", fromCol);
}

function handleBoardDrop(e, row, col, cell) {
  e.preventDefault();
  cell.style.background = '';
  const type = e.dataTransfer.getData("type");
  const letter = e.dataTransfer.getData("letter");
  const rackIdx = parseInt(e.dataTransfer.getData("rackIdx"));
  if (gameState.board[row][col] || pendingPlacements.find(p=>p.row===row&&p.col===col)) return;
  if (type === "rack") {
    pendingPlacements.push({row,col,letter,rackIdx});
  } else if (type === "pending") {
    const fromRow = parseInt(e.dataTransfer.getData("fromRow"));
    const fromCol = parseInt(e.dataTransfer.getData("fromCol"));
    const i = pendingPlacements.findIndex(
      p => p.row === fromRow && p.col === fromCol && p.rackIdx === rackIdx
    );
    if (i >= 0) pendingPlacements.splice(i, 1, {row, col, letter, rackIdx});
  }
  renderGame();
}

function handleRackDrop(e, rackDiv) {
  e.preventDefault();
  rackDiv.style.background = "";
  const type = e.dataTransfer.getData("type");
  if (type !== "pending") return;
  const rackIdx = parseInt(e.dataTransfer.getData("rackIdx"));
  const fromRow = parseInt(e.dataTransfer.getData("fromRow"));
  const fromCol = parseInt(e.dataTransfer.getData("fromCol"));
  const i = pendingPlacements.findIndex(
    p => p.row === fromRow && p.col === fromCol && p.rackIdx === rackIdx
  );
  if (i >= 0) pendingPlacements.splice(i, 1);
  renderGame();
}

function scoreOneWord(wordTiles) {
  let score = 0, wordMultipliers = [];
  for (const {letter, isNew, row, col} of wordTiles) {
    if (!letter) continue;
    let tileScore = LETTER_POINTS[letter.toUpperCase()] || 0;
    const bonus = BONUS_BOARD[row][col];
    if (isNew) {
      if (bonus === "DL") tileScore *= 2;
      if (bonus === "TL") tileScore *= 3;
      if (bonus === "DW") wordMultipliers.push(2);
      if (bonus === "TW") wordMultipliers.push(3);
      if (bonus === "CENTER") wordMultipliers.push(2);
    }
    score += tileScore;
  }
  let wordTotalMult = wordMultipliers.reduce((prod, val) => prod * val, 1);
  score *= wordTotalMult || 1;
  return score;
}

function getFullWordTiles(board, placements) {
  if (!placements.length) return [];
  const coords = placements.map(p => [p.row, p.col]);
  const allSameRow = coords.every(([r,_]) => r === coords[0][0]);
  const allSameCol = coords.every(([_,c]) => c === coords[0][1]);
  let wordTiles = [];
  if (allSameRow) {
    const row = coords[0][0];
    let minCol = Math.min(...coords.map(([_,c]) => c));
    let maxCol = Math.max(...coords.map(([_,c]) => c));
    while (minCol > 0 && board[row][minCol-1]) minCol--;
    while (maxCol < 14 && board[row][maxCol+1]) maxCol++;
    for (let col = minCol; col <= maxCol; ++col) {
      let letter = null, isNew = false;
      const pending = placements.find(p => p.row === row && p.col === col);
      if (pending) { letter = pending.letter; isNew = true; }
      else if (board[row][col]) { letter = board[row][col]; isNew = false; }
      else { letter = null; }
      wordTiles.push({letter, isNew, row, col});
    }
  } else if (allSameCol) {
    const col = coords[0][1];
    let minRow = Math.min(...coords.map(([r,_]) => r));
    let maxRow = Math.max(...coords.map(([r,_]) => r));
    while (minRow > 0 && board[minRow-1][col]) minRow--;
    while (maxRow < 14 && board[maxRow+1][col]) maxRow++;
    for (let row = minRow; row <= maxRow; ++row) {
      let letter = null, isNew = false;
      const pending = placements.find(p => p.row === row && p.col === col);
      if (pending) { letter = pending.letter; isNew = true; }
      else if (board[row][col]) { letter = board[row][col]; isNew = false; }
      else { letter = null; }
      wordTiles.push({letter, isNew, row, col});
    }
  }
  return wordTiles;
}

function getCrossWords(board, placements) {
  const crossWords = [];
  if (!placements.length) return crossWords;
  const coords = placements.map(p => [p.row, p.col]);
  const allSameRow = coords.every(([r,_]) => r === coords[0][0]);
  const allSameCol = coords.every(([_,c]) => c === coords[0][1]);
  for (const {row, col, letter} of placements) {
    let word = letter;
    let tiles = [{letter, isNew:true, row, col}];
    if (allSameRow) {
      let r = row - 1;
      while (r >= 0 && (board[r][col] || placements.find(p=>p.row===r&&p.col===col))) {
        const l = (placements.find(p=>p.row===r&&p.col===col)?.letter) || board[r][col];
        word = l + word;
        tiles.unshift({letter: l, isNew:false, row: r, col: col});
        r--;
      }
      r = row + 1;
      while (r < 15 && (board[r][col] || placements.find(p=>p.row===r&&p.col===col))) {
        const l = (placements.find(p=>p.row===r&&p.col===col)?.letter)||board[r][col];
        word = word + l;
        tiles.push({letter: l, isNew:false, row: r, col: col});
        r++;
      }
    } else if (allSameCol) {
      let c = col - 1;
      while (c >= 0 && (board[row][c] || placements.find(p=>p.row===row&&p.col===c))) {
        const l = (placements.find(p=>p.row===row&&p.col===c)?.letter)||board[row][c];
        word = l + word;
        tiles.unshift({letter: l, isNew:false, row: row, col: c});
        c--;
      }
      c = col + 1;
      while (c < 15 && (board[row][c] || placements.find(p=>p.row===row&&p.col===c))) {
        const l = (placements.find(p=>p.row===row&&p.col===c)?.letter)||board[row][c];
        word = word + l;
        tiles.push({letter: l, isNew:false, row: row, col: c});
        c++;
      }
    }
    if (word.length > 1) {
      crossWords.push({word, tiles});
    }
  }
  return crossWords;
}

function calculateWordScore(board, placements) {
  let mainWordTiles = getFullWordTiles(board, placements);
  let mainScore = scoreOneWord(mainWordTiles);

  const coords = placements.map(p => [p.row, p.col]);
  const allSameRow = coords.every(([r,_]) => r === coords[0][0]);
  const allSameCol = coords.every(([_,c]) => c === coords[0][1]);
  const crossWords = getCrossWords(board, placements);

  let crossScores = 0;
  for (const {word, tiles} of crossWords) {
    if ((allSameRow && tiles.every(t=>t.row===coords[0][0])) ||
        (allSameCol && tiles.every(t=>t.col===coords[0][1]))) continue;
    crossScores += scoreOneWord(tiles);
  }
  return {mainScore, crossScores, total: mainScore + crossScores, crossWords};
}