// ==========================================
// Network
//
// This class manages the connection between the client and the
// server and everything involved.
// ==========================================

// ==========================================
// Client
// ==========================================

// Constructor( socketio )
//
// Creates a new client using the specified socket interface.


//266 set false to true
try {
	var jsscompress = require("js-string-compression");
} catch(e) {}

function Client( socketio ) {
	this.io = socketio;
	this.eventHandlers = {};
	this.kicked = false;
}

// connect( uri, nickname )
//
// Connect to a server with the specified nickname.

Client.prototype.connect = function( uri, nickname ) {
	var socket = this.socket = this.io.connect( uri, { reconnect: false } );
	this.nickname = nickname;

	// Hook events
	var s = this;
	socket.on( "connect", function() { s.onConnection(); } );
	socket.on( "disconnect", function() { s.onDisconnection(); } );
	socket.on( "world", function( data ) { s.onWorld( data ); } );
	socket.on( "spawn", function( data ) { s.onSpawn( data ); } );
	socket.on( "setblock", function( data ) { s.onBlockUpdate( data ); } );
	socket.on( "msg", function( data ) { s.onMessage( data ); } );
	socket.on( "kick", function( data ) { s.onKick( data ); } );
	socket.on( "join", function( data ) { s.onPlayerJoin( data ); } );
	socket.on( "leave", function( data ) { s.onPlayerLeave( data ); } );
	socket.on( "player", function( data ) { s.onPlayerUpdate( data ); } );
	socket.on( "setpos", function( data ) { s.onPlayerSetPos( data ); } );
}

// Called to do a networked block update.
Client.prototype.setBlock = function( x, y, z, mat ){
	this.socket.emit( "setblock", {
		x: x,
		y: y,
		z: z,
		mat: mat.id
	});
}

// Send a chat message.
Client.prototype.sendMessage = function( msg ){
	this.socket.emit( "chat", {
		msg: msg
	} );
}

// updatePlayer()
//
// Sends the current player position and orientation to the server.

Client.prototype.updatePlayer = function() {
	var player = this.world.localPlayer;
	this.socket.emit( "player", {
		x: player.pos.x,
		y: player.pos.y,
		z: player.pos.z,
		pitch: player.angles[0],
		yaw: player.angles[1]
	} );
}

// on( event, callback )
//
// Hooks an event.

Client.prototype.on = function( event, callback ) {
	this.eventHandlers[event] = callback;
}

// Called when the client has connected.
Client.prototype.onConnection = function() {
	if ( this.eventHandlers["connect"] ) this.eventHandlers.connect();
	this.socket.emit( "nickname", { nickname: this.nickname } );
}

// Called when the client was disconnected.
Client.prototype.onDisconnection = function() {
	if ( this.eventHandlers["disconnect"] ) this.eventHandlers.disconnect( this.kicked );
}

// Called when the server has sent the world.
Client.prototype.onWorld = function( data ) {
	// Create world from string representation
	var world = this.world = new World( data.sx, data.sy, data.sz );
	var hm = new jsscompress.Hauffman();
	var decompressed = hm.decompress(data.blocks);
	world.createFromString( decompressed );
	if ( this.eventHandlers["world"] ) this.eventHandlers.world( world );
}

// Called when the local player is spawned.
Client.prototype.onSpawn = function( data ) {
	// Set spawn point
	this.world.spawnPoint = new Vector( data.x, data.y, data.z );
	if ( this.eventHandlers["spawn"] ) this.eventHandlers.spawn();
}

// Called when a block update is received from the server.
Client.prototype.onBlockUpdate = function( data ) {
	var material = BLOCK.fromId( data.mat );
	if ( this.eventHandlers["block"] ) this.eventHandlers.block( data.x, data.y, data.z, this.world.blocks[data.x][data.y][data.z], material );
	this.world.setBlock( data.x, data.y, data.z, material );
}

// Called when a message is received.
Client.prototype.onMessage = function( data ) {
	if ( data.type == "chat" ) {
		if ( this.eventHandlers["chat"] ) this.eventHandlers.chat( data.user, data.msg );
	} else if ( data.type == "generic" ) {
		if ( this.eventHandlers["message"] ) this.eventHandlers.message( data.msg );
	}
}

// Called when a kick message is received.
Client.prototype.onKick = function( data ) {
	this.kicked = true;
	if ( this.eventHandlers["kick"] ) this.eventHandlers.kick( data.msg );
}

// Called when a new player joins the game.
Client.prototype.onPlayerJoin = function( data ) {
	data.moving = false;
	data.aniframe = 0;
	this.world.players[data.nick] = data;
}

// Called when a player has left the game.
Client.prototype.onPlayerLeave = function( data ) {
	if ( this.world.players[data.nick].nametag ) {
		this.world.renderer.gl.deleteBuffer( this.world.players[data.nick].nametag.model );
		this.world.renderer.gl.deleteTexture( this.world.players[data.nick].nametag.texture );
	}
	delete this.world.players[data.nick];
}

// Called when the server has sent updated player info.
Client.prototype.onPlayerUpdate = function( data ) {
	if ( !this.world ) return;
	var pl = this.world.players[data.nick];
	if ( Math.abs(data.x - pl.x) > 0.1 ||
		 Math.abs(data.y - pl.y) > 0.1 ||
		 Math.abs(data.z - pl.z) > 0.1) {
		pl.moving = true;
	}
	pl.x = data.x;
	pl.y = data.y;
	pl.z = data.z;
	pl.pitch = data.pitch;
	pl.yaw = data.yaw;
	window.setTimeout(function(){pl.moving=false},100);
}

// Called when the server wants to set the position of the local player.
Client.prototype.onPlayerSetPos = function( data ) {
	this.world.localPlayer.pos = new Vector( data.x, data.y, data.z );
	this.world.localPlayer.velocity = new Vector( 0, 0, 0 );
}

// ==========================================
// Server
// ==========================================

// Creates a new server listening for clients using the specified
// socket interface. Slots is an optional maximum amount of clients.
function Server( socketio, slots ) {
    var express = require('express');
    var app = express();
    var http = require('http').Server(app);
	app.use(express.static('.'));
	app.get('/', (req, res) => {
		res.sendFile("/index.html", {root: __dirname});
	});
	var io = this.io = socketio(http),
	s = this;
	io.sockets.on( "connection", function( socket ) { s.onConnection( socket ); } );
	this.eventHandlers = {};
	this.activeNicknames = {};
	this.activeAddresses = {};
	this.maxSlots = slots;
	this.usedSlots = 0;
	this.oneUserPerIp = false;
    http.listen(3000, function() {});
}

// Assign a world to be networked.
Server.prototype.setWorld = function( world ) {
	this.world = world;
}

// Assign a log function to output activity to.
Server.prototype.setLogger = function( fn ) {
	this.log = fn;
}

// Enable/disable the one user per ip rule.
Server.prototype.setOneUserPerIp = function( enabled )
{
	this.oneUserPerIp = false;
}

// Hooks an event.
Server.prototype.on = function( event, callback ) {
	this.eventHandlers[event] = callback;
}

// Send a generic message to a certain client or everyone.
Server.prototype.sendMessage = function( msg, socket ) {
	var obj = socket ? socket : this.io.sockets;
	obj.emit( "msg", {
		type: "generic",
		msg: msg
	});
}

// Send a generic message to everyone except for the
// specified client.
Server.prototype.broadcastMessage = function( msg, socket ) {
	socket.broadcast.emit( "msg", {
		type: "generic",
		msg: msg
	});
}

// Kick a client with the specified message.
Server.prototype.kick = function( socket, msg ) {
	if ( this.log ) this.log( "Client " + this.getIp(socket) + " was kicked (" + msg + ")." );
    if ( socket._nickname != null )
        this.sendMessage( socket._nickname + " was kicked (" + msg + ")." );
    socket.emit( "kick", {
        msg: msg
    });
    socket.disconnect();
}

// Request a client to change their position.
Server.prototype.setPos = function( socket, x, y, z ) {
	socket.emit( "setpos", {
		x: x,
		y: y,
		z: z
	});
}

// Attempts to find a player by their nickname.
Server.prototype.findPlayerByName = function( name ) {
	for ( var p in this.world.players )
		if ( p.toLowerCase().indexOf( name.toLowerCase() ) != -1 ) return this.world.players[p];
	return null;
}

// Called when a new client has connected.
Server.prototype.onConnection = function( socket ) {
	if ( this.log ) this.log( "Client " + this.getIp(socket) + " connected to the server." );
	if ( this.maxSlots != null && this.usedSlots == this.maxSlots ) {
		this.kick( socket, "The server is full!" );
		return;
	}

	// Prevent people from blocking the server with multiple open clients
	if ( this.activeAddresses[this.getIp(socket)] && this.oneUserPerIp ) {
		this.kick( socket, "Multiple clients connecting from the same IP address!" );
		return;
	}
	this.activeAddresses[this.getIp(socket)] = true;
	this.usedSlots++;
	// Hook events
	var s = this;
	socket.on( "nickname", function( data ) { s.onNickname( socket, data ); } );
	socket.on( "setblock", function( data ) {s.onBlockUpdate( socket, data ); });
	socket.on( "chat", function( data ) { s.onChatMessage( socket, data ); } );
	socket.on( "player", function( data ) { s.onPlayerUpdate( socket, data ); } );
	socket.on( "disconnect", function() { s.onDisconnect( socket ); } );
}

// Called when a client has sent their nickname.
Server.prototype.onNickname = function( socket, data ) {
	if ( data.nickname.length == 0 || data.nickname.length > 15 ) return false;
	// Prevent people from changing their username
    if ( socket._nickname == null ) {
        var nickname = this.sanitiseInput( data.nickname );
        for ( var n in this.activeNicknames ) {
            if ( n.toLowerCase() == nickname.toLowerCase() ) {
                this.kick( socket, "That username is already in use!" );
                return;
            }
        }
        if ( this.log ) this.log( "Client " + this.getIp(socket) + " is now known as " + nickname + "." );
        if ( this.eventHandlers["join"] ) this.eventHandlers.join( socket, nickname );
        this.activeNicknames[data.nickname] = true;
        socket._nickname = nickname;
				var hm = new jsscompress.Hauffman();
				var world = this.world;
        socket.emit( "world", {
            sx: world.sx,
            sy: world.sy,
            sz: world.sz,
            blocks: hm.compress(world.toNetworkString())
        });
        socket.emit( "spawn", {
            x: world.spawnPoint.x,
            y: world.spawnPoint.y,
            z: world.spawnPoint.z
        });
        for ( var p in this.world.players ) {
            var pl = this.world.players[p];
            socket.emit( "join", {
                nick: p,
                x: pl.x,
                y: pl.y,
                z: pl.z,
                pitch: pl.pitch,
                yaw: pl.yaw
            });
        }
        socket.broadcast.emit( "join", {
            nick: nickname,
            x: world.spawnPoint.x,
            y: world.spawnPoint.y,
            z: world.spawnPoint.z,
            pitch: 0,
            yaw: 0
        });
        world.players[nickname] = {
            socket: socket,
            nick: nickname,
            lastBlockCheck: +new Date(),
            blocks: 0,
            x: world.spawnPoint.x,
            y: world.spawnPoint.y,
            z: world.spawnPoint.z,
            pitch: 0,
            yaw: 0
        };
    }
}

// Called when a client wants to change a block.
Server.prototype.onBlockUpdate = function( socket, data ) {
	var world = this.world;
	if ( typeof( data.x ) != "number" || typeof( data.y ) != "number" || typeof( data.z ) != "number" || typeof( data.mat ) != "number" ) return false;
	if ( data.x < 0 || data.y < 0 || data.z < 0 || data.x >= world.sx || data.y >= world.sy || data.z >= world.sz ) return false;
	if ( Math.sqrt( (data.x-world.spawnPoint.x)*(data.x-world.spawnPoint.x) + (data.y-world.spawnPoint.y)*(data.y-world.spawnPoint.y) + (data.z-world.spawnPoint.z)*(data.z-world.spawnPoint.z)  ) < 3 ) return false;
	var material = BLOCK.fromId( data.mat );
	if ( material == null || ( !material.spawnable && data.mat != 0 ) ) return false;
	// Check if the user has authenticated themselves before allowing them to set blocks
    if ( socket._nickname != null  ) {
        try {
            world.setBlock( data.x, data.y, data.z, material );
            var pl = this.world.players[socket._nickname];
            pl.blocks++;
            if ( +new Date() > pl.lastBlockCheck + 100 ) {
                if ( pl.blocks > 5 ) {
					//this.kick( socket, "Block spamming." );
					console.log("block spamming");
                    return;
                }
                pl.lastBlockCheck = +new Date();
                pl.blocks = 0;
            }
            this.io.sockets.emit( "setblock", {
                x: data.x,
                y: data.y,
                z: data.z,
                mat: data.mat
            });
        } catch ( e ) {
            console.log( "Error setting block at ( " + data.x + ", " + data.y + ", " + data.z + " ): " + e );
        }
    }
}

// Called when a client sends a chat message.
Server.prototype.onChatMessage = function( socket, data ) {
	if ( typeof( data.msg ) != "string" || data.msg.trim().length == 0 || data.msg.length > 100 ) return false;
	var msg = this.sanitiseInput( data.msg );
	// Check if the user has authenticated themselves before allowing them to send messages
    if ( socket._nickname != null  ) {
        if ( this.log ) this.log( "<" + socket._nickname + "> " + msg );
        var callback = false;
        if  ( this.eventHandlers["chat"] ) callback = this.eventHandlers.chat( socket, socket._nickname, msg );
        if ( !callback ) {
					if (msg.substr(0, 1) != "/") {
						this.io.sockets.emit( "msg", {
							type: "chat",
							user: socket._nickname,
							msg: msg
        		});
					}
        }
    }
}

// Called when a client sends a position/orientation update.
function normaliseAngle( ang ) {
	ang = ang % (Math.PI*2);
	if ( ang < 0 ) ang = Math.PI*2 + ang;
	return ang;
}

Server.prototype.onPlayerUpdate = function( socket, data ) {
		if ( typeof( data.x ) != "number" || typeof( data.y ) != "number" || typeof( data.z ) != "number" ) return false;
		if ( typeof( data.pitch ) != "number" || typeof( data.yaw ) != "number" ) return false;
    if ( socket._nickname != null  ) {
      var pl = this.world.players[socket._nickname];
      pl.x = data.x;
      pl.y = data.y;
      pl.z = data.z;
      pl.pitch = data.pitch;
      pl.yaw = data.yaw;
      for ( var p in this.world.players ) {
        var tpl = this.world.players[p];
        if ( tpl.socket == socket ) continue;
        var ang = Math.PI + Math.atan2( tpl.y - pl.y, tpl.x - pl.x ),
        	nyaw = Math.PI - tpl.yaw - Math.PI/2,
          inFrustrum = Math.abs( normaliseAngle( nyaw ) - normaliseAngle( ang ) ) < Math.PI/2;
        if ( inFrustrum ) {
          tpl.socket.volatile.emit( "player", {
            nick: socket._nickname,
            x: pl.x,
            y: pl.y,
            z: pl.z,
            pitch: pl.pitch,
            yaw: pl.yaw
          });
        }
      }
    }
}

// Called when a client has disconnected.
Server.prototype.onDisconnect = function( socket ){
	if ( this.log ) this.log( "Client " + this.getIp(socket) + " disconnected." );
	this.usedSlots--;
	delete this.activeAddresses[this.getIp(socket)];
    if ( socket._nickname != null ) {
        delete this.activeNicknames[socket._nickname];
        delete this.world.players[socket._nickname];
        socket.broadcast.emit( "leave", {
            nick: socket._nickname
        });
        if ( this.eventHandlers["leave"] ) this.eventHandlers.leave( socket._nickname );
    }
}

// Prevents XSS exploits and other bad things.
Server.prototype.sanitiseInput = function( str ) {
	return str.trim().replace( /</g, "&lt;" ).replace( />/g, "&gt;" ).replace( /\\/g, "&quot" );
}
Server.prototype.getIp = function( socket ) {
    return socket.request.connection.remoteAddress;
}
if ( typeof( exports ) != "undefined" ) {
	exports.Server = Server;
}
