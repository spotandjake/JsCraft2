var context = document.getElementById('materialselector2').getContext("2d");
	
var img = new Image();
img.onload = function () {
    context.drawImage(img, 0, 0);
}
img.src = "./media/image.png";