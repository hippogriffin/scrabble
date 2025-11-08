// --- Scrabble Board Constants and Points ---
const BOARD_SIZE = 15;

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

const LETTER_POINTS = {
  'A': 1, 'B': 3, 'C': 3, 'D': 2, 'E': 1, 'F': 4, 'G': 2, 'H': 4, 'I': 1,
  'J': 8, 'K': 5, 'L': 1, 'M': 3, 'N': 1, 'O': 1, 'P': 3, 'Q': 10, 'R': 1, 'S': 1,
  'T': 1, 'U': 1, 'V': 4, 'W': 4, 'X': 8, 'Y': 4, 'Z': 10
};

// --- Game State ---
let board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(""));
let players = [
  { name: 'Player 1', score: 0, rack: ['A', 'F', 'E', 'L', 'S', 'T', 'O'] },
  { name: 'Player 2', score: 0, rack: ['Q', 'U', 'A', 'R', 'T', 'Z', 'S'] },
  { name: 'Player 3', score: 0, rack: ['M', 'O', 'N', 'E', 'Y', 'R', 'C'] },
  { name: 'Player 4', score: 0, rack: ['B', 'R', 'O', 'W', 'N', 'D', 'X'] }
];
let tileBag = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(2).split('')];
let currentPlayerIdx = 0;
let pendingPlacements = []; // {row, col, letter, rackIdx}

// --- Draw new tiles for player after placement
function drawTiles(player, count = 7) {
  while (player.rack.length < count && tileBag.length > 0) {
    const rand = Math.floor(Math.random() * tileBag.length);
    player.rack.push(tileBag.splice(rand, 1)[0]);
  }
}

// --- Render Board and Players ---
function render() {
  // Board
  const boardDiv = document.getElementById('board');
  boardDiv.innerHTML = "";
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      let cell = document.createElement('div');
      cell.className = 'square';

      // Bonus square colour
      const bonus = BONUS_BOARD[row][col];
      if      (bonus === "TW")     cell.classList.add("tw");
      else if (bonus === "DW")     cell.classList.add("dw");
      else if (bonus === "TL")     cell.classList.add("tl");
      else if (bonus === "DL")     cell.classList.add("dl");
      else if (bonus === "CENTER") cell.classList.add("center");
      cell.dataset.row = row;
      cell.dataset.col = col;

      // If the cell is empty, add bonus hint text (CSS overlay)
      if (!board[row][col] && !pendingPlacements.find(p=>p.row===row&&p.col===col)) {
        if (bonus === "TW")         cell.setAttribute("data-bonus","TW");
        else if (bonus === "DW")    cell.setAttribute("data-bonus","DW");
        else if (bonus === "TL")    cell.setAttribute("data-bonus","TL");
        else if (bonus === "DL")    cell.setAttribute("data-bonus","DL");
        else if (bonus === "CENTER") cell.setAttribute("data-bonus","★");
        cell.setAttribute("data-empty","true");
      }
      // Show pending placed tile, else committed board tile
      const pendingTile = pendingPlacements.find(p => p.row === row && p.col === col);
      if (pendingTile) {
        cell.textContent = pendingTile.letter;
        cell.removeAttribute("data-empty");
      } else if (board[row][col]) {
        cell.textContent = board[row][col];
        cell.removeAttribute("data-empty");
      }

      // Drag/drop logic for board
      if (currentPlayerIdx === players.findIndex((_, i) => i === currentPlayerIdx)) {
        if (!pendingTile && board[row][col] === "") {
          cell.ondragover = (e) => { e.preventDefault(); cell.style.background = "#eccc68"; };
          cell.ondragleave = (e) => { e.preventDefault(); cell.style.background = ''; };
          cell.ondrop = (e) => handleBoardDrop(e, row, col, cell);
        }
        if (pendingTile) {
          cell.draggable = true;
          cell.style.cursor = 'grab';
          cell.ondragstart = (e) => handlePendingTileDragStart(e, pendingTile, row, col);
        }
      }

      boardDiv.appendChild(cell);
    }
  }

  // --- Players ---
  const playersDiv = document.getElementById('players');
  playersDiv.innerHTML = "";

  players.forEach((player, idx) => {
    let card = document.createElement('div');
    card.className = 'player-card';
    if (idx === currentPlayerIdx) card.style.borderColor = '#70a1ff';
    card.innerHTML = `<strong>${player.name}${idx === currentPlayerIdx ? " (Your turn)" : ""}</strong><br>Score: <span>${player.score}</span>`;
    let rackDiv = document.createElement('div');
    rackDiv.className = 'rack';

    player.rack.forEach((letter, tIdx) => {
      if (idx === currentPlayerIdx && pendingPlacements.some(p => p.rackIdx === tIdx)) return;
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.textContent = letter;
      // Enable drag
      if (idx === currentPlayerIdx && letter) {
        tile.draggable = true;
        tile.dataset.letter = letter;
        tile.dataset.rackIdx = tIdx;
        tile.ondragstart = (e) => handleTileDragStart(e, letter, tIdx);
      }
      rackDiv.appendChild(tile);
    });
    // Rack accepts returning pending tiles
    if (idx === currentPlayerIdx) {
      rackDiv.ondragover = (e) => { e.preventDefault(); rackDiv.style.background = "#eccc68"; };
      rackDiv.ondragleave = () => rackDiv.style.background = "";
      rackDiv.ondrop = (e) => handleRackDrop(e, rackDiv);
    }
    card.appendChild(rackDiv);
    playersDiv.appendChild(card);
  });
  renderEndTurnButton();
}

// --- Drag and Drop Handlers ---
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
  if (board[row][col] || pendingPlacements.find(p => p.row === row && p.col === col)) return;
  if (type === "rack") {
    pendingPlacements.push({ row, col, letter, rackIdx });
  } else if (type === "pending") {
    const fromRow = parseInt(e.dataTransfer.getData("fromRow"));
    const fromCol = parseInt(e.dataTransfer.getData("fromCol"));
    const i = pendingPlacements.findIndex(
      p => p.row === fromRow && p.col === fromCol && p.rackIdx === rackIdx
    );
    if (i >= 0) {
      pendingPlacements.splice(i, 1, { row, col, letter, rackIdx });
    }
  }
  render();
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
  render();
}

// --- Scrabble Scoring Including Crosswords ---
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

function getFullWordTiles(placements) {
  const coords = placements.map(p => [p.row, p.col]);
  const allSameRow = coords.every(([r,_]) => r === coords[0][0]);
  const allSameCol = coords.every(([_,c]) => c === coords[0][1]);
  let wordTiles = [];
  if (allSameRow) {
    const row = coords[0][0];
    let minCol = Math.min(...coords.map(([_,c]) => c));
    let maxCol = Math.max(...coords.map(([_,c]) => c));
    while (minCol > 0 && board[row][minCol-1]) minCol--;
    while (maxCol < BOARD_SIZE-1 && board[row][maxCol+1]) maxCol++;
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
    while (maxRow < BOARD_SIZE-1 && board[maxRow+1][col]) maxRow++;
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

function getFullWord() {
  // Used for main word only (string)
  const tiles = getFullWordTiles(pendingPlacements);
  return tiles.map(t => t.letter).join('');
}

function getCrossWords(placements) {
  const crossWords = [];
  const coords = placements.map(p => [p.row, p.col]);
  const allSameRow = coords.every(([r,_]) => r === coords[0][0]);
  const allSameCol = coords.every(([_,c]) => c === coords[0][1]);
  for (const {row, col, letter} of placements) {
    let word = letter;
    let tiles = [{letter, isNew:true, row, col}];
    if (allSameRow) {
      // Vertical cross-word
      let r = row - 1;
      while (r >= 0 && (board[r][col] || placements.find(p=>p.row===r&&p.col===col))) {
        const l = (placements.find(p=>p.row===r&&p.col===col)?.letter) || board[r][col];
        word = l + word;
        tiles.unshift({letter: l, isNew:false, row: r, col: col});
        r--;
      }
      r = row + 1;
      while (r < BOARD_SIZE && (board[r][col] || placements.find(p=>p.row===r&&p.col===col))) {
        const l = (placements.find(p=>p.row===r&&p.col===col)?.letter)||board[r][col];
        word = word + l;
        tiles.push({letter: l, isNew:false, row: r, col: col});
        r++;
      }
    } else if (allSameCol) {
      // Horizontal cross-word
      let c = col - 1;
      while (c >= 0 && (board[row][c] || placements.find(p=>p.row===row&&p.col===c))) {
        const l = (placements.find(p=>p.row===row&&p.col===c)?.letter)||board[row][c];
        word = l + word;
        tiles.unshift({letter: l, isNew:false, row: row, col: c});
        c--;
      }
      c = col + 1;
      while (c < BOARD_SIZE && (board[row][c] || placements.find(p=>p.row===row&&p.col===c))) {
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

function calculateWordScore(placements) {
  // Main word
  let mainWordTiles = getFullWordTiles(placements);
  let mainScore = scoreOneWord(mainWordTiles);

  // Crosswords from new tiles
  const coords = placements.map(p => [p.row, p.col]);
  const allSameRow = coords.every(([r,_]) => r === coords[0][0]);
  const allSameCol = coords.every(([_,c]) => c === coords[0][1]);
  const crossWords = getCrossWords(placements);

  let crossScores = 0;
  for (const {word, tiles} of crossWords) {
    if ((allSameRow && tiles.every(t => t.row === coords[0][0])) ||
        (allSameCol && tiles.every(t => t.col === coords[0][1]))) continue;
    crossScores += scoreOneWord(tiles);
  }
  return {mainScore, crossScores, total: mainScore + crossScores, crossWords};
}

// --- Placement and Validation ---
function isPlacementValidLine() {
  const coords = pendingPlacements.map(p => [p.row, p.col]);
  if (coords.length <= 1) return true;
  const rows = coords.map(x => x[0]);
  const cols = coords.map(x => x[1]);
  const allSameRow = rows.every(r => r === rows[0]);
  const allSameCol = cols.every(c => c === cols[0]);
  if (!allSameRow && !allSameCol) return false;
  const sorted = (allSameRow ? cols : rows).slice().sort((a, b) => a - b);
  for (let i = sorted[0]; i <= sorted[sorted.length-1]; ++i) {
    let r = allSameRow ? rows[0] : i;
    let c = allSameRow ? i : cols[0];
    if (
      !pendingPlacements.some(p => p.row === r && p.col === c)
      && !board[r][c]
    ) return false;
  }
  return true;
}

async function isValidWordAPI(word) {
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
    return response.ok;
  } catch {
    return false;
  }
}

// --- End Turn ---
async function endTurn() {
  if (!isPlacementValidLine()) {
    alert("Tiles must be in a straight and connected line!");
    return;
  }
  let wordsToCheck = [];
  const mainWord = getFullWord();
  if (!mainWord) {
    alert("No valid word was formed!");
    return;
  }
  wordsToCheck.push(mainWord);

  const crossWords = getCrossWords(pendingPlacements);
  for (const {word, tiles} of crossWords) {
    // Only score crosswords that are not identical to the main word orientation
    if (word.length > 1) wordsToCheck.push(word);
  }
  for (const w of wordsToCheck) {
    const valid = await isValidWordAPI(w);
    if (!valid) {
      alert(`'${w}' is not a valid English word!`);
      return;
    }
  }

  const scoreObj = calculateWordScore(pendingPlacements);
  const player = players[currentPlayerIdx];
  player.score += scoreObj.total;

  for (const place of pendingPlacements) {
    board[place.row][place.col] = place.letter;
    player.rack[place.rackIdx] = null;
  }
  player.rack = player.rack.filter(x => x);
  drawTiles(player);

  pendingPlacements = [];
  currentPlayerIdx = (currentPlayerIdx + 1) % players.length;
  render();
}

// --- Score Preview in UI ---
function renderEndTurnButton() {
  let btn = document.getElementById('endTurnBtn');
  let scoreSpan = document.getElementById('scorePreview');
  let scoreObj = calculateWordScore(pendingPlacements);

  if (!scoreSpan) {
    scoreSpan = document.createElement("span");
    scoreSpan.id = "scorePreview";
    scoreSpan.style.marginLeft = "16px";
    document.getElementById('game').appendChild(scoreSpan);
  }
  if (pendingPlacements.length > 0) {
    let crossWordStr = scoreObj.crossWords && scoreObj.crossWords.length
      ? " + Cross: " + scoreObj.crossScores
      : "";
    scoreSpan.textContent =
      `Word: ${scoreObj.mainScore}${crossWordStr} → Turn Total: ${scoreObj.total}`;
    scoreSpan.style.display = '';
  } else {
    scoreSpan.style.display = 'none';
  }

  if (!btn) {
    btn = document.createElement("button");
    btn.id = "endTurnBtn";
    btn.textContent = "End Turn";
    btn.style.marginTop = "25px";
    btn.onclick = () => endTurn();
    document.getElementById('game').appendChild(btn);
  }
  btn.style.display = pendingPlacements.length > 0 ? '' : 'none';
}

// --- Initialization ---
window.onload = render;