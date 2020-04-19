"use strict";
var exceptionScene = {
	activeBtn: false,
	activeBtnElement: false,
	ui: document.getElementById("exceptionDiv"),
	messageP: document.getElementById("exceptionMessageP"),
	throw(message){
		this.messageP.textContent = message;
		sceneManager.pushModal(this);
	},
	start(){
		loadingScreen.style.display = "none";
		this.ui.style.display = "block";
	},
	suspend(){
		this.ui.style.display = "none";
	},

	init(){
		const sceneCloseBtn = closeBtn.cloneNode(true);
		sceneCloseBtn.addEventListener("mousedown", e => {sceneManager.popModal();});
		exceptionScene.ui.prepend(sceneCloseBtn);
	}
}
exceptionScene.init();