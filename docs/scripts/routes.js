"use strict";
const routes = {
	"/": {
		start(){
			//canvasEventManager.reset();
			this.ui.style.display = "block";
			if(tutorialStep != -1){
				tutorialScene.removeCurrentEventListener();
				tutorialStep = -1;
			}
		},
		suspend(){
			this.ui.style.display = "none";
		},
		onUserChanged(){
			console.log(user);
			if(user) {
				this.accountBtn.textContent = user.displayName;
				this.accountBtn.onclick = () => {sceneManager.push(profileScene)};
			} else {
				this.accountBtn.textContent = "Login";
				this.accountBtn.onclick = () => {sceneManager.push(loginScene)};
			}
		},
		unlockLevel(levelNum){
			this.levelBtns[levelNum].onclick = () => {
				assemblyScene.startLevel("levels/" + levelNum + ".json");
			};
			this.levelBtns[levelNum].classList.add("unlockedLevelBtn");
		},

		//levelBtns: document.getElementsByClassName("levelBtn"),
		ui: document.getElementById("menuUI"),
		pathname: "",
		accountBtn: document.getElementById("accountBtn"),

		init(){
			document.getElementById("originalLevelsBtn").addEventListener("pointerdown", () => {
				//sceneManager.float(levelBrowserScene, {collectionPath: "originalLevels"});
				sceneManager.push("/listing/original");
			});
			document.getElementById("userLevelsBtn").addEventListener("pointerdown", () => {
				//sceneManager.float(levelBrowserScene, {collectionPath: "userLevels"});
				sceneManager.push("/listing/community");
			});
			document.getElementById("sandboxBtn").addEventListener("pointerdown", () => {
				canvasEventManager.reset();
				sceneManager.push("/sandbox");
			});
		}
	},
	"/listing": {
		ui: document.getElementById("levelBrowserUi"),
		async start(query){
			console.log(query);
			//loadingScreen.style.display = "flex";
			//if(query){
				//await 
				this.populate(query);
			//}
			this.ui.style.display = "block";
			//loadingScreen.style.display ="none";
		},
		suspend(){
			this.ui.style.display = "none";
		},
		rows: [],
		cells: [],
		maxLevels: 10,
		levels: [],
		currentLevel: null,
		currentLevelIndex: 0,
		refDef: null,
		lastDoc: null,
		async populate(query){
			this.levels.length = 0;
			//this.refDef = refDef;
			let ref = db.collection(query);
			//if(refDef.getNextBatch) {
			//	if(!lastDoc){
				//	throw "!lastDoc";
			//	}
			//	ref = ref.startAfter(this.lastDoc);
		//	}
			const levelsSnap = (await ref.limit(this.maxLevels).get()).docs;
			const len = levelsSnap.length;
			if(len){
				await this.normalizeLevels(levelsSnap);
				this.lastDoc = levelsSnap[len - 1];
				for(let i = 0; i != len; ++i){
					this.rows[i].style.display = "table-row";
					this.rows[i].onpointerdown = () => {
						this.startLevel(i);
					};
					this.cells[i][0].textContent = this.levels[i].name;
					this.cells[i][1].textContent = this.levels[i].author;
					this.cells[i][2].textContent = this.levels[i].dateCreated.toDate().toDateString();
					this.cells[i][3].textContent = this.levels[i].rating;
					this.cells[i][4].textContent = this.levels[i].plays;
					if(this.levels[i].review){
						this.rows[i].classList.add("completed-level");
					} else {
						this.rows[i].classList.remove("completed-level");
					}
				}
			}

			for(let i = len; i != this.maxLevels; ++i){
				this.rows[i].style.display = "none";
			}
		},

		async normalizeLevels(docs){
			const len = docs.length;
			if(len){
				const ids = [];
				for(let i = 0; i != len; ++i){
					const level = docs[i].data();
					const id = docs[i].id;
					ids[i] = id;
					level.id = id;
					level.path = docs[i].ref.path;
					this.levels[i] = level;
				}
				if(user){
					const reviewSnap = (await db.collection("users").doc(user.uid).collection("reviews").where(firebase.firestore.FieldPath.documentId(), "in", ids).get()).docs;
					const snapLen = reviewSnap.length;
					for(let i = 0; i != len; ++i){
						const id = this.levels[i].id;
						for(let j = 0; j != snapLen; ++j){
							if(id == reviewSnap[j].id){
								this.levels[i].review = reviewSnap[j].data();
								break;
							}
						}
					}
				}
			}
		},

		startLevel(index){
			sceneManager.pushModal(modeScene, this.levels[index]);
		},

		async loadLevel(level){
			this.currentLevel = level;
			let levelData = null;
			try {
				levelData = JSON.parse(this.currentLevel.json);
			} catch(e) {
				exceptionScene.throw("Level corrupted, could not deserialize");
				throw e;
			}
			if(true || !/solutions$/.test(this.refDef.collectionPath)){
				canvasEventManager.reset();
			}
			sandboxMode = true;
			loadLevelScene.load(levelData);
			sandboxMode = false;
			const batch = db.batch();
			batch.update(db.doc(this.currentLevel.path), {plays: firebase.firestore.FieldValue.increment(1)});
			if(!this.currentLevel.review){
				this.currentLevel.review = {rating: 0};
				batch.set(db.doc("users/" + user.uid + "/reviews/" + this.currentLevel.id), this.currentLevel.review);
			}
			await batch.commit()
				.catch((err) => {
					exceptionScene.throw(err);
					throw err;
				});
			//sceneManager.push(modeScene);
		},

		init(){
			//const sceneCloseBtn = closeBtn.cloneNode(true);
			//sceneCloseBtn.addEventListener("pointerdown", () => {sceneManager.pop();});
			//this.ui.prepend(sceneCloseBtn);
			const rowsLive = document.getElementById("levelBrowser").tBodies[0].rows;
			const rowLen = rowsLive[0].cells.length;
			for(let i = 0; i != this.maxLevels; ++i){
				this.rows[i] = rowsLive[i];
				this.cells[i] = [];
				for(let j = 0; j < rowLen; ++j){
					this.cells[i][j] = rowsLive[i].cells[j];
				}
			}
		}
	},
	"/sandbox": {
		toolbar: document.getElementById("sandboxToolbar"),

		async start(docPath){
			this.toolbar.style.display = "flex";
			let level = history.state;
			if(!level && docPath) {
				await routes["/listing"].normalizeLevels([await db.doc(base64ToString(docPath)).get()]);
				level = routes["/listing"].levels[0];
			}
			if(level){
				await routes["/listing"].loadLevel(level);
			}
			sandboxMode = true;
		},
		suspend(){
			this.toolbar.style.display = "none";
		},

		init() {
			addBtn(startSimulationBtn.cloneNode(true), this.toolbar, () => {simulationManager.begin(this);});
			addBtn(ccwWheelCreatorBtn.cloneNode(true), this.toolbar, ccwWheelCreatorEventHandler);
			addBtn(nWheelCreatorBtn.cloneNode(true), this.toolbar, nWheelCreatorEventHandler);
			addBtn(cwWheelCreatorBtn.cloneNode(true), this.toolbar, cwWheelCreatorEventHandler);
			addBtn(tWheelCreatorBtn.cloneNode(true), this.toolbar, tWheelCreatorEventHandler);
			addBtn(nRodCreatorBtn.cloneNode(true), this.toolbar, nRodCreatorEventHandler);
			addBtn(cRodCreatorBtn.cloneNode(true), this.toolbar, cRodCreatorEventHandler);
			addBtn(gRodCreatorBtn.cloneNode(true), this.toolbar, gRodCreatorEventHandler);
			addBtn(polygonBtn.cloneNode(true), this.toolbar, () => {sceneManager.push(createPolygonScene);});
			addBtn(moveBtn.cloneNode(true), this.toolbar, moveEventHandler);
			addBtn(removeBtn.cloneNode(true), this.toolbar, removeEventHandler);
			addBtn(assemblyFieldCreatorBtn.cloneNode(true), this.toolbar, assemblyFieldCreatorEventHandler);
			addBtn(goalFieldCreatorBtn.cloneNode(true), this.toolbar, goalFieldCreatorEventHandler);
			addBtn(saveLevelBtn.cloneNode(true), this.toolbar, () => {sceneManager.pushModal(saveScene);});
			addBtn(loadLevelBtn.cloneNode(true), this.toolbar, () => {sceneManager.push(loadLevelScene);});
			//addBtn(backBtn.cloneNode(true), this.toolbar, () => {sceneManager.pop();});
		}
	},
	"/play": {
		async start(docPath){
			this.toolbar.style.display = "flex";
			if(history.state){
				this.currentLevel = history.state;
			} else if(docPath) {
				await routes["/listing"].normalizeLevels([await db.doc(base64ToString(docPath)).get()]);
				this.currentLevel = routes["/listing"].levels[0];
			} else {
				exceptionScene.throw("This url is incorrectly formatted");
				return;
			}
			await routes["/listing"].loadLevel(this.currentLevel);
			sandboxMode = false;
		},
		suspend(){
			if(simulationManager.isSimulating){
				simulationManager.end();
			}
			this.toolbar.style.display = "none";
		},
		toolbar: document.getElementById("assemblySceneBtnsDiv"),
		currentLevel: null,
	
		init(){
			addBtn(startSimulationBtn.cloneNode(true), this.toolbar, () => {simulationManager.begin(this);});
			addBtn(ccwWheelCreatorBtn.cloneNode(true), this.toolbar, ccwWheelCreatorEventHandler);
			addBtn(nWheelCreatorBtn.cloneNode(true), this.toolbar, nWheelCreatorEventHandler);
			addBtn(cwWheelCreatorBtn.cloneNode(true), this.toolbar, cwWheelCreatorEventHandler);
			addBtn(nRodCreatorBtn.cloneNode(true), this.toolbar, nRodCreatorEventHandler);
			addBtn(cRodCreatorBtn.cloneNode(true), this.toolbar, cRodCreatorEventHandler);
			addBtn(moveBtn.cloneNode(true), this.toolbar, moveEventHandler);
			addBtn(removeBtn.cloneNode(true), this.toolbar, removeEventHandler);
			//addBtn(saveLevelBtn.cloneNode(true), this.toolbar, () => {sceneManager.float(saveScene);});
			//addBtn(backBtn.cloneNode(true), this.toolbar, () => {sceneManager.pop();});
		}
	}
}
for(const route in routes){
	routes[route].init();
}