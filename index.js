// ==========================================
// Server


//fix world bottom
//add in back button
//mini canvas click to switch selected block
//update fluid mechanics
//change textures
//fix fall through world

// Parameters
var WORLD_SX = 60; //128
var WORLD_SY = 60; //128
var WORLD_SZ = 32; //32
var WORLD_GROUNDHEIGHT = 16;
var SECONDS_BETWEEN_SAVES = 10;
var ADMIN_IP = "";

// Load modules
var modules = {};
modules.helpers = require("./js/helpers.js");
modules.blocks = require("./js/blocks.js");
modules.world = require("./js/world.js");
modules.network = require("./js/network.js");
modules.physics = require("./js/physics.js");
modules.io = require("socket.io");
modules.fs = require("fs");
modules.jsscompress = require("js-string-compression");
var log = require("util").log;

// Set-up evil globals
global.Vector = modules.helpers.Vector;
global.BLOCK = modules.blocks.BLOCK;

function getFilesizeInBytes(filename) {
    var stats = modules.fs.statSync(filename)
    var fileSizeInBytes = stats["size"]
    return fileSizeInBytes
	}

// Create new empty world or load one from file
var world = new modules.world.World(WORLD_SX, WORLD_SY, WORLD_SZ);
log("Creating world...");
if (world.loadFromFile("world.jscraft", modules.jsscompress)) {
	log("Loaded the world from file.");
} else {
	log("Creating a new empty world.");
	world.createFlatWorld(WORLD_GROUNDHEIGHT);
	world.saveToFile("world.jscraft", modules.jsscompress);
}
Physics = new modules.physics.Physics();
Physics.setWorld(world);
setInterval(function() {
	var time = new Date().getTime() / 1000.0;
	Physics.simulate();
	while (new Date().getTime() / 1000 - time < 0.016);
}, 1);

// Start server
var server = new modules.network.Server(modules.io, 16);
server.setWorld(world);
server.setLogger(log);
server.setOneUserPerIp(false);
log("Waiting for clients...");

// Chat commands
server.on("chat", function(client, nickname, msg) {
	if (msg == "/spawn") {
		server.setPos(client, world.spawnPoint.x, world.spawnPoint.y, world.spawnPoint.z);
		return true;
	} else if (msg.substr(0, 3) == "/tp") {
		if (msg.split(" ").length == 2) {
			var target = msg.substr(4);
			target = server.findPlayerByName(target);
			if (target != null) {
				server.setPos(client, target.x, target.y, target.z);
				server.sendMessage(nickname + " was teleported to " + target.nick + ".");
				return true;
			} else {
				server.sendMessage("Couldn't find that player!", client);
				return false;
			}
		} else if (msg.split(" ").length == 4) {
			var target = server.findPlayerByName(nickname);
			if (msg.split(" ")[1].startsWith("~")) {
				var x = msg.split(" ")[1].replace("~", target.x);
				var x = eval(x);
			} else {
				var x = msg.split(" ")[1]
			}
			if (msg.split(" ")[2].startsWith("~")) {
				var y = msg.split(" ")[2].replace("~", target.y);
				var y = eval(y);
			} else {
				var y = msg.split(" ")[2]
			}
			if (msg.split(" ")[3].startsWith("~")) {
				var z = msg.split(" ")[3].replace("~", target.z);
				var z = eval(z);
			} else {
				var z = msg.split(" ")[3]
			}
			server.setPos(client, parseInt(x), parseInt(y), parseInt(z));
			server.sendMessage(`${nickname} was teleported to x:${x}, y:${y}, z:${z}`);
		} 
	} else if (msg.split(" ")[0] == "/whisper") {
		var target = msg.split(" ")[1];
		target = server.findPlayerByName(target);
		server.sendMessage(msg.replace('/whisper', '').replace(msg.split(" ")[0], ""), target.socket);
	} else if (msg.substr(0, 5) == "/kick" && client.handshake.address.address == ADMIN_IP) {
		var target = msg.substr(6);
		target = server.findPlayerByName(target);
		if (target != null) {
			server.kick(target.socket, "Kicked by Overv");
			return true;
		} else {
			server.sendMessage("Couldn't find that player!", client);
			return false;
		}
	} else if (msg == "/list") {
		var playerlist = "";
		for (var p in world.players)
			playerlist += p + ", ";
		playerlist = playerlist.substring(0, playerlist.length - 2);
		server.sendMessage("Players: " + playerlist, client);
		return true;
	} else if (msg.substr(0, 9) == "/setblock") {
		var command = msg.split(' ');
		server.onBlockUpdate(client, { x: parseInt(command[1]), y: parseInt(command[2]), z: parseInt(command[3]), mat: parseInt(command[4]) });
	} else if (msg.substr(0, 1) == "/") {
		server.sendMessage("Unknown command!", client);
		return false;
	}
});

// Send a welcome message to new clients
server.on("join", function(client, nickname) {
	server.sendMessage("Welcome! Enjoy your stay, " + nickname + "!", client);
	server.broadcastMessage(nickname + " joined the game.", client);
});

// And let players know of a disconnecting user
server.on("leave", function(nickname) {
	server.sendMessage(nickname + " left the game.");
});

// Periodical saves
setInterval(function() {
	world.saveToFile("world.jscraft", modules.jsscompress);
	log("Saved world to file.");
}, SECONDS_BETWEEN_SAVES * 1000);