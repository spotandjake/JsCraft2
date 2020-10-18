// ==========================================
// Physics
//
// This class contains the code that takes care of simulating
// processes like gravity and fluid flow in the world.
// ==========================================

// Constructor()
//
// Creates a new physics simulator.
function Physics()
{
	this.lastStep = -1;
}

// setWorld( world )
//
// Assigns a world to simulate to this physics simulator.

Physics.prototype.setWorld = function( world )
{
	this.world = world;
}

// simulate()
//
// Perform one iteration of physics simulation.
// Should be called about once every second.

Physics.prototype.simulate = function()
{
	var world = this.world;
	var blocks = world.blocks;
	
	var step = Math.floor( new Date().getTime() / 100 );
	if ( step == this.lastStep ) return;
	this.lastStep = step;
	
	// Gravity
	if ( step % 1 == 0 )
	{
		for ( var x = 0; x < world.sx; x++ ) {
			for ( var y = 0; y < world.sy; y++ ) {
				for ( var z = 0; z < world.sz; z++ ) {
					if ( blocks[x][y][z].gravity && z > 0 && (blocks[x][y][z-1] == BLOCK.AIR || blocks[x][y][z-1] == BLOCK.LAVA)) {
						if(blocks[x][y][z].fluid == true) {
							world.setBlock( x, y, z - 1, blocks[x][y][z]);
						} else {
							world.setBlock( x, y, z - 1, blocks[x][y][z] );
							world.setBlock( x, y, z, BLOCK.AIR );
						}
					}
				}
			}
		}
	}
	//tnt
	if (step % 10 == 0) {
		for ( var x = 0; x < world.sx; x++ ) {
			for ( var y = 0; y < world.sy; y++ ) {
				for ( var z = 0; z < world.sz; z++ ) {
					if (blocks[x][y][z].id == BLOCK.TNT.id) {
						if (blocks[x][y][z].explode == true) {
							for ( var j = -1; j < 2; j++ ) {
								for ( var k = -1; k < 2; k++ ) {
									for ( var l = -1; l < 2; l++ ) {
										world.setBlock( x+j, y+k, z+l, BLOCK.AIR );
									}
								}
							}
						}
					}
				}
			}
		}
	}
	// Fluids
	if ( step % 20 == 0 ) {
		// updated in the same step, creating a simulation avalanche.
		var newFluidBlocks = {};
		for ( var x = 0; x < world.sx; x++ ) {
			for ( var y = 0; y < world.sy; y++ ) {
				for ( var z = 0; z < world.sz; z++ ) {
					var material = blocks[x][y][z];
					var source = material.source;
					if (material.source != null) {
						if (material.fluid && !(blocks[source[0]][source[1]][source[2]].id << material.stage) ) {
							world.setBlock( x, y, z, BLOCK.AIR );
						}
					}
					if ( material.fluid && newFluidBlocks[x+","+y+","+z] == null && material.stage >= 0.6 && blocks[x][y][z-1].id != material.id) {
						var newfluid = JSON.parse(JSON.stringify(material));
						newfluid.stage -= 0.1;
						newfluid.source = [x, y, z];
						newfluid.texture = BLOCK.fromId(material.id).texture;
						if (material.source != null) {
							if (!(blocks[source[0]][source[1]][source[2]].id != material.id)) {
								if ( x > 0 && blocks[x-1][y][z] == BLOCK.AIR ) {
									world.setBlock( x - 1, y, z, newfluid);
									newFluidBlocks[(x-1)+","+y+","+z] = true;
								}
								if ( x < world.sx - 1 && blocks[x+1][y][z] == BLOCK.AIR ) {
									world.setBlock( x + 1, y, z, newfluid );
									newFluidBlocks[(x+1)+","+y+","+z] = true;
								}
								if ( y > 0 && blocks[x][y-1][z] == BLOCK.AIR ) {
									world.setBlock( x, y - 1, z, newfluid);
									newFluidBlocks[x+","+(y-1)+","+z] = true;
								}
								if ( y < world.sy - 1 && blocks[x][y+1][z] == BLOCK.AIR ) {
									world.setBlock( x, y + 1, z, newfluid );
									newFluidBlocks[x+","+(y+1)+","+z] = true;
								}
							}
						} else {
							if ( x > 0 && blocks[x-1][y][z] == BLOCK.AIR ) {
								world.setBlock( x - 1, y, z, newfluid);
								newFluidBlocks[(x-1)+","+y+","+z] = true;
							}
							if ( x < world.sx - 1 && blocks[x+1][y][z] == BLOCK.AIR ) {
								world.setBlock( x + 1, y, z, newfluid );
								newFluidBlocks[(x+1)+","+y+","+z] = true;
							}
							if ( y > 0 && blocks[x][y-1][z] == BLOCK.AIR ) {
								world.setBlock( x, y - 1, z, newfluid);
								newFluidBlocks[x+","+(y-1)+","+z] = true;
							}
							if ( y < world.sy - 1 && blocks[x][y+1][z] == BLOCK.AIR ) {
								world.setBlock( x, y + 1, z, newfluid );
								newFluidBlocks[x+","+(y+1)+","+z] = true;
							}
						}
					}
				}
			}
		}
	}
}
// Export to node.js
if ( typeof( exports ) != "undefined" )
{
	exports.Physics = Physics;
}