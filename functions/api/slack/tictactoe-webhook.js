// Slack webhook to handle Alex's moves from Slack
// Alex can reply with a number 0-8 to make a move

export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  
  try {
    const body = await request.json();
    
    // Handle Slack event verification
    if (body.type === 'url_verification') {
      return new Response(JSON.stringify({ challenge: body.challenge }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Handle message events
    if (body.event?.type === 'message' && body.event.text) {
      // Ignore bot messages
      if (body.event.bot_id) {
        return new Response('OK');
      }
      
      const text = body.event.text.trim();
      
      // Check if message is a single digit 0-8
      const match = text.match(/^([0-8])$/);
      if (!match) {
        return new Response('OK'); // Ignore non-move messages
      }
      
      const position = parseInt(match[1]);
      
      // Get current game
      const gameData = await env.TICTACTOE_KV.get('current_game');
      if (!gameData) {
        return new Response('OK');
      }
      
      const game = JSON.parse(gameData);
      
      // Validate it's Alex's turn
      if (game.currentTurn !== 'alex' || game.status !== 'active') {
        return new Response('OK');
      }
      
      if (game.board[position] !== '') {
        // Send error message
        await sendSlackMessage(env, `❌ Cell ${position} is already taken!`);
        return new Response('OK');
      }
      
      // Make the move
      game.board[position] = 'X';
      game.currentTurn = 'world';
      game.lastMove = Date.now();
      game.moveHistory.push({ player: 'alex', position, timestamp: Date.now() });
      
      // Check for win/draw
      const result = checkGameResult(game.board);
      if (result) {
        game.status = result;
        if (result === 'alexWon') game.stats.alexWins++;
        else if (result === 'draw') game.stats.draws++;
      }
      
      // Save game
      await env.TICTACTOE_KV.put('current_game', JSON.stringify(game));
      
      // Send confirmation
      const positionNames = ['top-left', 'top-center', 'top-right', 'middle-left', 'center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'];
      let message = `✅ You played position ${position} (${positionNames[position]})!\n\n`;
      
      if (result === 'alexWon') {
        message += '🏆 You won!';
      } else if (result === 'draw') {
        message += '🤝 Game is a draw!';
      } else {
        message += `Waiting for The World's move...`;
      }
      
      await sendSlackMessage(env, message);
      
      return new Response('OK');
    }
    
    return new Response('OK');
  } catch (err) {
    console.error('Slack webhook error:', err);
    return new Response('Error', { status: 500 });
  }
}

function checkGameResult(board) {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  
  for (const pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] === 'X' ? 'alexWon' : 'worldWon';
    }
  }
  
  if (board.every(cell => cell !== '')) {
    return 'draw';
  }
  
  return null;
}

async function sendSlackMessage(env, text) {
  try {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.SLACK_BOT_TOKEN}`
      },
      body: JSON.stringify({
        channel: env.SLACK_CHANNEL_ID || '#general',
        text: text
      })
    });
  } catch (err) {
    console.error('Failed to send Slack message:', err);
  }
}
