// ==========================================
// Player
//
// This class contains the code that manages the local player.
// ==========================================

// Mouse event enumeration
MOUSE = {};
MOUSE.DOWN = 1;
MOUSE.UP = 2;
MOUSE.MOVE = 3;

// Creates a new local player manager.
function Player() {}
function inRange(x, min, max) { 
	return ((x-min)*(x-max) <= 0);
}
// Assign the local player to a world.
Player.prototype.setWorld = function( world, pos ) {
	this.world = world;
	this.world.localPlayer = this;
	this.pos = world.spawnPoint;
	this.velocity = new Vector( 0, 0, 0 );
	this.angles = [ 0, Math.PI, 0 ];
	this.falling = false;
	this.blockselect = 0;
  this.fly = false;
	this.keys = {};
	this.buildMaterial = BLOCK.DIRT;
	this.eventHandlers = {};
  this.targetPitch = 0;
	this.targetYaw = 0;
}

// Assign the local player to a socket client.
Player.prototype.setClient = function( client ) {
	this.client = client;
}

// Set the canvas the renderer uses for some input operations.
Player.prototype.setInputCanvas = function( id ) {
	var canvas = this.canvas = document.getElementById( id );
	var t = this;
	document.onkeydown = function( e ) { if ( e.target.tagName != "INPUT" ) { t.onKeyEvent( e.keyCode, true ); return false; } }
	document.onkeyup = function( e ) { if ( e.target.tagName != "INPUT" ) { t.onKeyEvent( e.keyCode, false ); return false; } }
                             
	// Hook mouse move events
	document.addEventListener('wheel', function( event ){ t.wheel( event ); return false; }, false);
	document.addEventListener("mousemove", function ( e ) {t.onMouseEvent( e.movementX, e.movementY, MOUSE.MOVE, e.which == 3);return false;}, false);                                
	document.addEventListener("click",  function( e ) { t.onMouseEvent( window.innerWidth/2, window.innerHeight/2, MOUSE.UP, e.which == 3, e.which); });
}

// Hook a player event.
Player.prototype.on = function( event, callback ) {
	this.eventHandlers[event] = callback;
}

// Hook for keyboard input.
Player.prototype.onKeyEvent = function( keyCode, down ) {
	var key = String.fromCharCode( keyCode ).toLowerCase();
	this.keys[key] = down;
	this.keys[keyCode] = down;
	if ( !down && key == "t" && this.eventHandlers["openChat"] ) this.eventHandlers.openChat();
	if ( !down && key == "¿" && this.eventHandlers["openChat"] ) this.eventHandlers.openChat("/");
}

// Hook for mouse input.
Player.prototype.onMouseEvent = function( x, y, type, rmb, which) {
	if ( type == MOUSE.UP && which != 2) {
		this.doBlockAction( x, y, !rmb );
		this.dragging = false;
	} else if (type == MOUSE.MOVE) {
		this.dragging = true;
		//check if is not look upward or downward, before apply
    var result = this.targetPitch - y / 1000;
    if(result < Math.PI/2 && result > -Math.PI/2) this.targetPitch -= y / 1000;
    this.targetYaw += x / 1000;
  } else if (type == 2) {
		var bPos = new Vector( Math.floor( this.pos.x ), Math.floor( this.pos.y ), Math.floor( this.pos.z ) );
		var block = this.canvas.renderer.pickAt( new Vector( bPos.x - 4, bPos.y - 4, bPos.z - 4 ), new Vector( bPos.x + 4, bPos.y + 4, bPos.z + 4 ), x, y );
		var obj = this.client ? this.client : this.world;
		var matselect = obj.getBlock(block.x, block.y, block.z);
		this.blockselect = matselect.id;
	}
}

// Called to perform an action based on the player's block selection and input.
Player.prototype.doBlockAction = function( x, y, destroy ) {
	var bPos = new Vector( Math.floor( this.pos.x ), Math.floor( this.pos.y ), Math.floor( this.pos.z ) );
	var block = this.canvas.renderer.pickAt( new Vector( bPos.x - 4, bPos.y - 4, bPos.z - 4 ), new Vector( bPos.x + 4, bPos.y + 4, bPos.z + 4 ), x, y );
	if ( block != false ) {
		var obj = this.client ? this.client : this.world;
		if ( destroy ) {
			obj.setBlock( block.x, block.y, block.z, BLOCK.AIR );
    } else {
			obj.setBlock( block.x + block.n.x, block.y + block.n.y, block.z + block.n.z, this.buildMaterial );
		}
	}
}

// Returns the position of the eyes of the player for rendering.
Player.prototype.getEyePos = function() {
	return this.pos.add( new Vector( 0.0, 0.0, 1.7 ) );
}

//scroll
Player.prototype.wheel = function( event ) {
	var delta = Math.sign(event.deltaY)
	if ( delta == -1 ) {
		if ( this.blockselect == 19 ) this.blockselect = 2;
		else this.blockselect += 1
	}
	if ( delta == 1 ) {
		if ( this.blockselect == 2 ) this.blockselect = 19;
		else this.blockselect -= 1
	}
}

// Updates this local player (gravity, movement)
Player.prototype.update = function() {
	var world = this.world;
	var velocity = this.velocity;
	var pos = this.pos;
	var bPos = new Vector( Math.floor( pos.x ), Math.floor( pos.y ), Math.floor( pos.z ));
	if ( this.lastUpdate != null ) {
		var delta = ( new Date().getTime() - this.lastUpdate ) / 1000;

		// View
		if ( this.dragging ) {
			this.angles[0] += ( this.targetPitch - this.angles[0] ) * 30 * delta;
			this.angles[1] += ( this.targetYaw - this.angles[1] ) * 30 * delta;
			if ( this.angles[0] < -Math.PI/2 ) this.angles[0] = -Math.PI/2;
			if ( this.angles[0] > Math.PI/2 ) this.angles[0] = Math.PI/2;
		}

		//display info
		var localx = +this.pos.x.toFixed(3);
		var localy = +this.pos.y.toFixed(3);
		var localz = +this.pos.z.toFixed(3);
		document.getElementById( "cords" ).innerHTML = `XYZ: ${localx}, ${localy}, ${localz}`;

		//falling stop
		if (localz < -300) {
      velocity.z = 0;
      pos = world.spawnPoint;
		}

		//materials
		var context = document.getElementById('materialselector').getContext("2d");
		var canv =  document.getElementById('materialselector');
		var img = new Image();
		img.src = "./media/textures/terrain.png"
		if ( this.keys[49] ) this.blockselect = 2;
		if ( this.keys[50] ) this.blockselect = 3; 
		if ( this.keys[51] ) this.blockselect = 4;
		if ( this.keys[52] ) this.blockselect = 5;
		if ( this.keys[53] ) this.blockselect = 6;
		if ( this.keys[54] ) this.blockselect = 7;
		if ( this.keys[55] ) this.blockselect = 8;
		if ( this.keys[56] ) this.blockselect = 9;
		if ( this.keys[57] ) this.blockselect = 10;
		if ( this.keys[48] ) this.blockselect = 11;
		if ( this.keys[39] ) {
			if ( this.blockselect == 19 ) this.blockselect = 2;
			else this.blockselect += 1;
		}
		if ( this.keys[37] ) {
			if ( this.blockselect == 2 ) this.blockselect = 19;
			else this.blockselect -= 1;
		}
		switch (this.blockselect) {
			case 2:
				this.buildMaterial = BLOCK.DIRT;
				context.drawImage(img, 32, 0, 16, 16, 0, 0, canv.width, canv.height);
				break;
			case 3:
				this.buildMaterial = BLOCK.WOOD;
				context.drawImage(img, 80, 16, 16, 16, 0, 0, canv.width, canv.height);
				break;
			case 4:
				this.buildMaterial = BLOCK.TNT;
				context.drawImage(img, 128, 0, 16, 16, 0, 0, canv.width, canv.height);
				break;
			case 5:
				this.buildMaterial = BLOCK.BOOKCASE;
				context.drawImage(img, 48, 32, 16, 16, 0, 0, canv.width, canv.height);
				break;
			case 6:
				this.buildMaterial = BLOCK.LAVA;
				context.drawImage(img, 208, 224, 16, 16, 0, 0, canv.width, canv.height);
				break;
			case 7:
				this.buildMaterial = BLOCK.PLANK;
				context.drawImage(img, 64, 0, 16, 16, 0, 0, canv.width, canv.height);
				break;
			case 8: 
				this.buildMaterial = BLOCK.COBBLESTONE;
				context.drawImage(img, 0, 16, 16, 16, 0, 0, canv.width, canv.height);
				break;
			case 9:
				this.buildMaterial = BLOCK.CONCRETE;
				context.drawImage(img, 16, 0, 16, 16, 0, 0, canv.width, canv.height);
				break;
			case 10:
				this.buildMaterial = BLOCK.BRICK;
				context.drawImage(img, 112, 0, 16, 16, 0, 0, canv.width, canv.height);
				break;
			case 11:
				this.buildMaterial = BLOCK.SAND;
				context.drawImage(img, 0, 176, 16, 16, 0, 0, canv.width, canv.height);
				break;
			case 12:
				this.buildMaterial = BLOCK.GRAVEL;
				context.drawImage(img, 0, 0, 16, 16, 0, 0, canv.width, canv.height);
				break;
			case 13:
				this.buildMaterial = BLOCK.IRON;
				context.drawImage(img, 96, 16, 16, 16, 0, 0, canv.width, canv.height);
				break;
			case 14:
				this.buildMaterial = BLOCK.GOLD;
				context.drawImage(img, 112, 16, 16, 16, 0, 0, canv.width, canv.height);
				break;
			case 15:
				this.buildMaterial = BLOCK.DIAMOND;
				context.drawImage(img, 128, 16, 16, 16, 0, 0, canv.width, canv.height);
				break;
			case 16:
				this.buildMaterial = BLOCK.OBSIDIAN;
				context.drawImage(img, 80, 32, 16, 16, 0, 0, canv.width, canv.height);
				break;
			case 17:
				this.buildMaterial = BLOCK.GLASS;
				context.clearRect(0, 0, canv.width, canv.height);
				context.drawImage(img, 16, 48, 16, 16, 0, 0, canv.width, canv.height);
				break;
			case 18:
				this.buildMaterial = BLOCK.SPONGE;
				context.drawImage(img, 0, 48, 16, 16, 0, 0, canv.width, canv.height);
				break;
			case 19:
				this.buildMaterial = BLOCK.TORCH;
				context.clearRect(0, 0, canv.width, canv.height);
				context.drawImage(img, 0, 80, 16, 16, 0, 0, canv.width, canv.height);
				break;
			default:
				this.buildMaterial = BLOCK.DIRT;
				context.drawImage(img, 32, 0, 16, 16, 0, 0, canv.width, canv.height);
		}
		// Gravity
		if ( this.falling ) velocity.z += -0.5;

		// Jumping
		if ( this.keys[32] && !this.falling ) velocity.z = 8;
		//Flying
    if ( this.keys[69] ) {
      if ( !this.fly )
        this.fly = true;
    }
    if ( this.keys[81] ) {
      if ( this.fly ) this.fly = false;
    }
		if ( this.fly ) {
			if ( this.keys[32] ) {
				velocity.z = 8;
			} else if ( this.keys[18] ) {
				velocity.z = -8;
				if ( !this.falling ) {
					this.fly = false;
				}
			} else {
				velocity.z = 0;
			}
		}

		// Walking
		var running = this.keys[16];
		var walkVelocity = new Vector( 0, 0, 0 );
			if ( this.keys[87] ) {
				walkVelocity.x += Math.cos( Math.PI / 2 - this.angles[1] );
				walkVelocity.y += Math.sin( Math.PI / 2 - this.angles[1] );
			}
			if ( this.keys[83] ) {
				walkVelocity.x += Math.cos( Math.PI + Math.PI / 2 - this.angles[1] );
				walkVelocity.y += Math.sin( Math.PI + Math.PI / 2 - this.angles[1] );
			}
			if ( this.keys[65] ) {
				walkVelocity.x += Math.cos( Math.PI / 2 + Math.PI / 2 - this.angles[1] );
				walkVelocity.y += Math.sin( Math.PI / 2 + Math.PI / 2 - this.angles[1] );
			}
			if ( this.keys[68] ) {
				walkVelocity.x += Math.cos( -Math.PI / 2 + Math.PI / 2 - this.angles[1] );
				walkVelocity.y += Math.sin( -Math.PI / 2 + Math.PI / 2 - this.angles[1] );
			}
		if ( walkVelocity.length() > 0 ) {
				walkVelocity = walkVelocity.normal();
        velocity.x = walkVelocity.x * 4;
				velocity.y = walkVelocity.y * 4;
		} else {
			// change the value when falling for less in-air dampening
			velocity.x /= this.falling ? 1.05 : 1.5;
			velocity.y /= this.falling ? 1.05 : 1.5;
		}
		// Resolve collision
    this.pos = this.resolveCollision( pos, bPos, velocity.mul( delta ));
	}
	this.lastUpdate = new Date().getTime();
}

// Resolves collisions between the player and blocks on XY level for the next movement step.
Player.prototype.resolveCollision = function( pos, bPos, velocity )
{
	var world = this.world;
	var playerRect = { x: pos.x + velocity.x, y: pos.y + velocity.y, size: 0.25 };

	// Collect XY collision sides
	var collisionCandidates = [];
	for ( var x = bPos.x - 1; x <= bPos.x + 1; x++ ) {
		for ( var y = bPos.y - 1; y <= bPos.y + 1; y++ ) {
			for ( var z = bPos.z; z <= bPos.z + 1; z++ ) {
				if ( world.getBlock( x, y, z ) != BLOCK.AIR && world.getBlock( x, y, z ).fluid != true) {
					if ( world.getBlock( x - 1, y, z ) == BLOCK.AIR || world.getBlock( x - 1, y, z ).fluid == true) collisionCandidates.push( { x: x, dir: -1, y1: y, y2: y + 1 } );
					if ( world.getBlock( x + 1, y, z ) == BLOCK.AIR || world.getBlock( x + 1, y, z ).fluid == true) collisionCandidates.push( { x: x + 1, dir: 1, y1: y, y2: y + 1 } );
					if ( world.getBlock( x, y - 1, z ) == BLOCK.AIR || world.getBlock( x, y - 1, z ).fluid == true) collisionCandidates.push( { y: y, dir: -1, x1: x, x2: x + 1 } );
					if ( world.getBlock( x, y + 1, z ) == BLOCK.AIR || world.getBlock( x, y + 1, z ).fluid == true) collisionCandidates.push( { y: y + 1, dir: 1, x1: x, x2: x + 1 } );
				}
			}
		}
	}

	// Solve XY collisions
	for( var i in collisionCandidates ) {
		var side = collisionCandidates[i];
		if ( lineRectCollide( side, playerRect ) ) {
			if ( side.x != null && velocity.x * side.dir < 0 ) {
				pos.x = side.x + playerRect.size / 2 * ( velocity.x > 0 ? -1 : 1 );
				velocity.x = 0;
			} else if ( side.y != null && velocity.y * side.dir < 0 ) {
				pos.y = side.y + playerRect.size / 2 * ( velocity.y > 0 ? -1 : 1 );
				velocity.y = 0;
			}
		}
	}
	var playerFace = { x1: pos.x + velocity.x - 0.125, y1: pos.y + velocity.y - 0.125, x2: pos.x + velocity.x + 0.125, y2: pos.y + velocity.y + 0.125 };
	var newBZLower = Math.floor( pos.z + velocity.z );
	var newBZUpper = Math.floor( pos.z + 1.7 + velocity.z * 1.1 );

	// Collect Z collision sides
	collisionCandidates = [];
	for ( var x = bPos.x - 1; x <= bPos.x + 1; x++ ) {
		for ( var y = bPos.y - 1; y <= bPos.y + 1; y++ ) {
			if ( world.getBlock( x, y, newBZLower ) != BLOCK.AIR && world.getBlock( x, y, newBZLower ).fluid != true)
				collisionCandidates.push( { z: newBZLower + 1, dir: 1, x1: x, y1: y, x2: x + 1, y2: y + 1 } );
			if ( world.getBlock( x, y, newBZUpper ) != BLOCK.AIR && world.getBlock( x, y, newBZLower ).fluid != true)
				collisionCandidates.push( { z: newBZUpper, dir: -1, x1: x, y1: y, x2: x + 1, y2: y + 1 } );
		}
	}

	// Solve Z collisions
	this.falling = true;
	for ( var i in collisionCandidates ) {
		var face = collisionCandidates[i];
		if ( rectRectCollide( face, playerFace ) && velocity.z * face.dir < 0 ) {
			if ( velocity.z < 0 ) {
				this.falling = false;
				pos.z = face.z;
				velocity.z = 0;
				this.velocity.z = 0;
			} else {
				pos.z = face.z - 1.8;
				velocity.z = 0;
				this.velocity.z = 0;
			}
			break;
		}
	}

	// Return solution
	return pos.add( velocity );
}