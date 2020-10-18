$(function() {
	var splashes = [
		"2019",
		"Awesome!",
		"100% pure JS, Html and Css!",
		"May contain Dirt!",
    "Better than Java",
    "Made By Spot",
    "Glitchy",
    "JsCraft",
    "Online",
    "100% Free"
	];
	$("#splash").html(
		$("#splash")
			.html()
			.replace("", splashes[Math.floor(Math.random() * splashes.length)])
	);
});