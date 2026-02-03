// Tic-tac-toe game state management
// Single global game: Alex vs The World

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  if (request.method === 'GET') {
    return getGameState(env);
  } else if (request.method === 'POST') {
    return makeMove(request, env);
  }
  
  return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Get current game state
async function getGameState(env) {
  try {
    const gameData = await env.TICTACTOE_KV.get('current_game');
    
    if (!gameData) {
      // Initialize new game
      const initialGame = createNewGame();
      await env.TICTACTOE_KV.put('current_game', JSON.stringify(initialGame));
      return new Response(JSON.stringify(initialGame), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(gameData, {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Make a move (for The World)
async function makeMove(request, env) {
  try {
    const { position } = await request.json();
    
    if (typeof position !== 'number' || position < 0 || position > 8) {
      return new Response(JSON.stringify({ error: 'Invalid position (0-8)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get current game
    const gameData = await env.TICTACTOE_KV.get('current_game');
    const game = gameData ? JSON.parse(gameData) : createNewGame();
    
    // Validate move
    if (game.currentTurn !== 'world') {
      return new Response(JSON.stringify({ error: "It's Alex's turn!" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (game.board[position] !== '') {
      return new Response(JSON.stringify({ error: 'Cell already taken' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (game.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Game is not active' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Make the move
    game.board[position] = 'O'; // World plays O
    game.currentTurn = 'alex';
    game.lastMove = Date.now();
    game.moveHistory.push({ player: 'world', position, timestamp: Date.now() });
    
    // Check for win/draw
    const result = checkGameResult(game.board);
    if (result) {
      game.status = result;
      if (result === 'worldWon') game.stats.worldWins++;
      else if (result === 'draw') game.stats.draws++;
    }
    
    // Save game
    await env.TICTACTOE_KV.put('current_game', JSON.stringify(game));
    
    // Send Slack notification (if not game over)
    if (game.status === 'active') {
      await notifySlack(env, position);
    }
    
    return new Response(JSON.stringify(game), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Create a new game
function createNewGame() {
  return {
    board: ['', '', '', '', '', '', '', '', ''], // 9 empty cells
    currentTurn: 'world', // World goes first
    status: 'active', // active, alexWon, worldWon, draw
    lastMove: Date.now(),
    moveHistory: [],
    stats: { alexWins: 0, worldWins: 0, draws: 0 }
  };
}

// Check win/draw conditions
function checkGameResult(board) {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6] // diagonals
  ];
  
  for (const pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] === 'X' ? 'alexWon' : 'worldWon';
    }
  }
  
  // Check for draw
  if (board.every(cell => cell !== '')) {
    return 'draw';
  }
  
  return null;
}

// Send Slack notification
async function notifySlack(env, position) {
  try {
    const positionNames = ['top-left', 'top-center', 'top-right', 'middle-left', 'center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'];
    
    const message = {
      text: `🌎 *The World just moved!*\nPosition: ${positionNames[position]} (${position})\n\nYour turn, Alex! Reply with your move.`,
      channel: env.SLACK_CHANNEL_ID || '#general'
    };
    
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.SLACK_BOT_TOKEN}`
      },
      body: JSON.stringify(message)
    });
  } catch (err) {
    console.error('Failed to send Slack notification:', err);
  }
}
