const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname));

// Об'єкт для зберігання ігор (пінг-понг, тетріс, гонки)
let games = {
    pingPong: {},
    tetris: {},
    racing: {}
};

io.on('connection', (socket) => {
    // Пінг-понг
    socket.on('joinPingPong', () => {
        let gameId = null;
        for (const id in games.pingPong) {
            if (games.pingPong[id].players.length < 2) {
                gameId = id;
                break;
            }
        }
        if (!gameId) {
            gameId = Date.now().toString();
            games.pingPong[gameId] = {
                players: [],
                ball: { x: 300, y: 200, dx: 5, dy: -5 },
                scores: { player1: 0, player2: 0 }
            };
        }
        games.pingPong[gameId].players.push(socket.id);
        socket.join(gameId);
        socket.emit('gameId', { gameId, gameType: 'pingPong' });

        if (games.pingPong[gameId].players.length === 2) {
            io.to(gameId).emit('startGame');
            updatePingPongGame(gameId);
        }
    });

    socket.on('movePaddle', ({ gameId, x }) => {
        const game = games.pingPong[gameId];
        if (game) {
            io.to(gameId).emit('updateGame', {
                opponentPaddleX: x,
                ball: game.ball,
                scores: game.scores
            });
        }
    });

    socket.on('scoreUpdate', ({ gameId, scores }) => {
        const game = games.pingPong[gameId];
        if (game) {
            game.scores = scores;
            io.to(gameId).emit('updateGame', { ball: game.ball, scores });
        }
    });

    // Тетріс
    socket.on('joinTetris', () => {
        let gameId = null;
        for (const id in games.tetris) {
            if (games.tetris[id].players.length < 2) {
                gameId = id;
                break;
            }
        }
        if (!gameId) {
            gameId = Date.now().toString();
            games.tetris[gameId] = {
                players: [],
                boards: [{}, {}], // Дошки двох гравців
                scores: { player1: 0, player2: 0 }
            };
        }
        games.tetris[gameId].players.push(socket.id);
        socket.join(gameId);
        socket.emit('gameId', { gameId, gameType: 'tetris' });

        if (games.tetris[gameId].players.length === 2) {
            io.to(gameId).emit('startGame');
        }
    });

    socket.on('updateTetrisBoard', ({ gameId, board, score, gameOver }) => {
        const game = games.tetris[gameId];
        if (game) {
            const playerIndex = game.players.indexOf(socket.id);
            game.boards[playerIndex] = board;
            game.scores[playerIndex === 0 ? 'player1' : 'player2'] = score;
            io.to(gameId).emit('updateTetris', {
                opponentBoard: board,
                scores: game.scores,
                gameOver
            });
        }
    });

    // Гонки
    socket.on('joinRacing', () => {
        let gameId = null;
        for (const id in games.racing) {
            if (games.racing[id].players.length < 2) {
                gameId = id;
                break;
            }
        }
        if (!gameId) {
            gameId = Date.now().toString();
            games.racing[gameId] = {
                players: [],
                positions: [{ x: 180, distance: 0 }, { x: 180, distance: 0 }],
                obstacles: [],
                scores: { player1: 0, player2: 0 }
            };
        }
        games.racing[gameId].players.push(socket.id);
        socket.join(gameId);
        socket.emit('gameId', { gameId, gameType: 'racing' });

        if (games.racing[gameId].players.length === 2) {
            io.to(gameId).emit('startGame');
            updateRacingGame(gameId);
        }
    });

    socket.on('updateRacingPosition', ({ gameId, x, distance, score, gameOver }) => {
        const game = games.racing[gameId];
        if (game) {
            const playerIndex = game.players.indexOf(socket.id);
            game.positions[playerIndex] = { x, distance };
            game.scores[playerIndex === 0 ? 'player1' : 'player2'] = score;
            io.to(gameId).emit('updateRacing', {
                opponentPosition: { x, distance },
                obstacles: game.obstacles,
                scores: game.scores,
                gameOver
            });
        }
    });

    socket.on('disconnect', () => {
        for (const gameType of ['pingPong', 'tetris', 'racing']) {
            const gameList = games[gameType];
            for (const gameId in gameList) {
                const game = gameList[gameId];
                game.players = game.players.filter(id => id !== socket.id);
                if (game.players.length === 0) {
                    delete gameList[gameId];
                } else {
                    io.to(gameId).emit('playerDisconnected');
                }
            }
        }
    });
});

function updatePingPongGame(gameId) {
    const game = games.pingPong[gameId];
    if (game && game.players.length === 2) {
        game.ball.x += game.ball.dx;
        game.ball.y += game.ball.dy;
        if (game.ball.x < 0 || game.ball.x > 600) game.ball.dx = -game.ball.dx;
        if (game.ball.y < 0 || game.ball.y > 400) game.ball.dy = -game.ball.dy;
        io.to(gameId).emit('updateGame', { ball: game.ball, scores: game.scores });
        setTimeout(() => updatePingPongGame(gameId), 1000 / 60);
    }
}

function updateRacingGame(gameId) {
    const game = games.racing[gameId];
    if (game && game.players.length === 2) {
        if (Math.random() < 0.05) {
            game.obstacles.push({ x: Math.random() * 360, y: 0 });
        }
        game.obstacles.forEach(o => (o.y += 5));
        game.obstacles = game.obstacles.filter(o => o.y < 400);
        io.to(gameId).emit('updateRacing', {
            obstacles: game.obstacles,
            scores: game.scores
        });
        setTimeout(() => updateRacingGame(gameId), 1000 / 60);
    }
}

server.listen(process.env.PORT || 3000);
