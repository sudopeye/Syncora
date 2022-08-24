"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const node_fetch_1 = __importDefault(require("node-fetch"));
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server);
const apiKeys = {
    LastFM: "65d8aef09c0e03d06b477054a190913c",
    YouTube: "AIzaSyCcOHQxktvZ27u7xV30eTM92Dhy0FRtalc"
};
var sessions = {};
io.on('connection', async (socket) => {
    var roomID;
    /**
     * Join room
     * @param id ID of the room to join
     */
    function join(id) {
        if (/^[a-zA-Z0-9]+$/.test(id)) {
            roomID = id;
            socket.join(id);
            io.to(id).emit('join', socket.id);
            io.to(socket.id).emit('update', sessions[id]);
        }
        else {
            io.to(socket.id).emit('error', "roomID can only contain alphanumeric characters");
        }
    }
    /**
     * Return a list of songs from a list of YouTube video IDs or search queries
     * @param urls a list of queries for youtube or youtube urls
     */
    async function getSongs(urls) {
        if (urls) {
            var songs = [];
            var yt = { i: [], id: [] };
            for (let i = 0; i < urls.length; i++) {
                const url = urls[i];
                var ytid = url.match(/(?<=yt\:)[a-zA-Z0-9_\-]{11}$/);
                if (ytid) {
                    yt.i.push(i);
                    yt.id.push(ytid[0]);
                }
                else {
                    var lastfminfo = url.match(/^https:\/\/www\.last\.fm\/music\/([A-Za-z0-9-_.%!~*'()+]+)(?:\/_)?\/([A-Za-z0-9-_.%!~*'()+]+)/);
                    var search;
                    if (lastfminfo?.length > 2) {
                        search = decodeURIComponent(lastfminfo[1]).replaceAll("+", " ") + " - " + decodeURIComponent(lastfminfo[2]).replaceAll("+", " ");
                        songs[i] = {
                            name: decodeURIComponent(lastfminfo[2]).replaceAll("+", " "),
                            artist: decodeURIComponent(lastfminfo[1]).replaceAll('+', " "),
                            url: undefined,
                            length: undefined
                        };
                    }
                    else {
                        search = url;
                    }
                    let response = await (0, node_fetch_1.default)(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(search)}&type=video&key=${apiKeys.YouTube}`)
                        .then(res => res.json()).catch(err => null);
                    if (response?.items[0]?.id.videoId) {
                        yt.i.push(i);
                        yt.id.push(response.items[0].id.videoId);
                    }
                    else {
                        songs[i] = null;
                    }
                }
            }
            console.log(yt);
            if (yt.id.length > 0) {
                let response = await (0, node_fetch_1.default)(`https://youtube.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${yt.id.toString()}&key=${apiKeys.YouTube}`)
                    .then(res => res.json()).catch(err => null);
                console.log(response);
                if (response?.items?.length == yt.id.length) {
                    for (let i = 0; i < yt.id.length; i++) {
                        let length = response.items[i].contentDetails.duration.match(/^PT([0-9]*(?=H))?H?([0-9]*(?=M))?M?([0-9]*(?=S))?S?$/);
                        for (let index = 0; index < length.length; index++) {
                            if (!length[index]) {
                                length[index] = 0;
                            }
                            else if (typeof length[index] != "number") {
                                length[index] = Number(length[index]);
                            }
                        }
                        songs[yt.i[i]] = {
                            name: songs[yt.i[i]]?.name || response.items[i].snippet.title,
                            artist: songs[yt.i[i]]?.artist || response.items[i].snippet.channelTitle,
                            length: length[1] * 360 + length[2] * 60 + length[3],
                            url: 'https://youtube.com/watch?v=' + yt.id[i]
                        };
                    }
                    io.to(socket.id).emit('update', songs);
                }
            }
        }
    }
    socket.on('join', join);
    socket.on('getSongs', getSongs);
});
server.listen(3000, () => {
    (console.log('listening on port 3000'));
});
app.get('/', (req, res) => {
    res.redirect(`room/${generateID(6, sessions)}`);
});
app.get('/room/:id', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});
app.use(express_1.default.static('dist/public'));
/**
 *
 * @param length length of generated ID
 * @param object object to generate unique id for
 * @param characters list of characters to use. Defaults to all alphanumeric characters
 * @returns ID
 */
function generateID(length, object, characters) {
    var chars = characters;
    if (!chars) {
        chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    }
    let ID = "";
    for (let i = 0; i < length; i++) {
        ID = ID + chars[Math.floor(Math.random() * chars.length)];
    }
    if (object[ID]) {
        return generateID(length, object);
    }
    return ID;
}
