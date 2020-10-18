var started = false;
function sound() {
  var splashes = [
    "media/songs/alpha.mp3",
    "media/songs/Air.ogg"
  ];
  var choice = splashes[Math.floor(Math.random() * splashes.length)];
  if (!started) {
    var audio = new Audio(choice);
      audio.play();
    started = true;
  }
}