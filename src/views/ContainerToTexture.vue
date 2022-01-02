<template>
	<div id="root">
		<div id="canvas"></div>
	</div>
</template>

<script>
import {
	Application,
	Loader,
	Sprite,
	Texture,
	Container,
	BLEND_MODES,
	RenderTexture,
	BaseRenderTexture,
	SCALE_MODES,
	Geometry,
	Shader,
	Mesh,
	// Renderer,
} from 'pixi.js';
import { Layer, Stage } from '../../public/lib/pixi-layers';

import { getEachFrameData } from '../utils/pixiUtils';
const PATH_INFO = require('../data/filterPath_ske.json');

const mapWidth = 7495;
const mapHeight = 4686;

export default {
	data() {
		return {
			app: null,
			rootContainer: null,
			stagePosition: { x: 386, y: 0 },
			stagePivot: { x: 386, y: 0 },
			pkqSprite: null,
			stageScale: 0.3,
			uniforms: {},
			plainGeometry: null,
			rootRenderTexture: null,
			showMap: false,
			uniforms: {},

			// 手势操作相关
			touchFlag: 0, //手势操作 0，1
			currentStagePosition: {
				//手势操作时，记录当前位置信息
				x: 0,
				y: 0,
			},
			singleFingerPosition: {
				//单指操作时，手指在屏幕上的位置
				clientX: 0,
				clientY: 0,
			},
			diffPosition: {
				//单指位移距离
				clientX: 0,
				clientY: 0,
			},

			// 双指位置信息
			firstFingerPosition: {
				clientX: 0,
				clientY: 0,
			},
			secondFingerPositiion: {
				clientX: 0,
				clientY: 0,
			},
			initDistance: 0, //双指落下时的距离
			currentDistance: 0, //双指缩放时的距离
			currentScale: 0.3, //当前缩放
			scaleCoefficient: 2, //缩放系数
			touchesArr: [],
			lockedScale: false,
			scaleBeforeChange: 0,
		};
	},
	mounted() {
		this.init();
	},
	methods: {
		init() {
			this.app = new Application({
				// width: window.innerWidth,
				// height: window.innerHeight,
				width: 7495 * this.stageScale,
				height: 4686 * this.stageScale,
			});
			document.querySelector('#canvas').appendChild(this.app.view);

			// const stage = (this.app.stage = new Stage());
			this.app.stage = new Stage();

			// 设置初始信息
			this.setMapInfo(
				this.stageScale,
				this.stagePosition,
				this.stagePivot,
			);

			var loader = new Loader();
			loader
				.add('bg_diffuse', '/light/day.jpg')
				.load(this.onAssetsLoaded);
		},
		onAssetsLoaded(loader, res) {
			var bg = new Sprite(res.bg_diffuse.texture);
			this.pkqSprite = new Sprite(new Texture.from('/img/pkq.png'));

			this.rootContainer = new Container();
			this.app.stage.addChild(this.rootContainer);

			this.rootContainer.addChild(bg);
			this.rootContainer.addChild(this.pkqSprite);

			this.rootRenderTexture = new RenderTexture(
				new BaseRenderTexture(
					this.rootContainer.width,
					this.rootContainer.height,
					SCALE_MODES.LINEAR,
					1,
				),
			);
			this.addShader();
		},
		addShader() {
			this.plainGeometry = new Geometry()
				.addAttribute(
					'aVertexPosition',
					[
						0,
						0,
						mapWidth,
						0,
						0,
						mapHeight,
						mapWidth,
						0,
						0,
						mapHeight,
						mapWidth,
						mapHeight,
					],
					2,
				)
				.addAttribute(
					'aTextureCoord',
					[0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1],
					2,
				);

			const vertexSrc = `
                precision mediump float;

                    attribute vec2 aVertexPosition;

                    uniform mat3 translationMatrix;
                    uniform mat3 projectionMatrix;

                    uniform vec2 u_Resolution;

                    attribute vec2 aTextureCoord;

                    varying vec2 vTextureCoord;
                    varying vec3 v_Position;
                    varying vec3 v_Normal;

                    void main() {
                        gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
                        vTextureCoord = aTextureCoord;
                        v_Position = vec3(aVertexPosition.x/u_Resolution.x,aVertexPosition.y/u_Resolution.y,0.0);
                        v_Normal = vec3(0.0,0.0,1.0);
                    }
            `;

			const fragmentSrc = `
                precision mediump float;
                
                uniform sampler2D uSampler2;

                varying vec2 vTextureCoord;

                // 宽高比
                uniform vec2 u_Resolution;
                //环境光强度因子
                uniform float u_AmbientFactor;
                //环境光
                uniform vec3 u_AmbientLight;
                // 点光源位置
                uniform vec3 u_PointLightPosition;
                uniform vec3 u_PointLightPosition1;
                uniform vec3 u_PointLightPosition2;
                //点光源颜色
                uniform vec3 u_PointLightColor;

                //当前像素点位置
                varying vec3 v_Position;
                varying vec3 v_Normal;


                float blendScreen(float base, float blend) {
                    return 1.0-((1.0-base)*(1.0-blend));
                }

                vec3 blendScreen(vec3 base, vec3 blend) {
                    return vec3(blendScreen(base.r,blend.r),blendScreen(base.g,blend.g),blendScreen(base.b,blend.b));
                }

                void main() {
                    vec4 sample = texture2D(uSampler2, vTextureCoord);

                    vec3 ambient = u_AmbientFactor * u_AmbientLight;

                    float rate = u_Resolution.x/u_Resolution.y;
                    vec3 currentPosition = vec3(v_Position.x,v_Position.y/rate,v_Position.z);

                    // 光源照射方向向量
                    vec3 lightDirection = u_PointLightPosition - currentPosition;
                    vec3 lightDirection1 = u_PointLightPosition1 - currentPosition;
                    vec3 lightDirection2 = u_PointLightPosition2 - currentPosition;
                    // 漫反射因子
                    float diffuseFactor = dot(normalize(lightDirection), normalize(v_Normal));
                    float diffuseFactor1 = dot(normalize(lightDirection1), normalize(v_Normal));
                    float diffuseFactor2 = dot(normalize(lightDirection2), normalize(v_Normal));

                    // 如果是负数，说明光线与法向量夹角大于 90 度，此时照不到平面上，所以没有光照，即黑色。
                    diffuseFactor = max(diffuseFactor, 0.0);
                    diffuseFactor1 = max(diffuseFactor1, 0.0);
                    diffuseFactor2 = max(diffuseFactor2, 0.0);

                    // 漫反射光照 = 光源颜色 * 漫反射因子。
                    vec3 diffuseLightColor = u_PointLightColor * diffuseFactor;
                    vec3 diffuseLightColor1 = u_PointLightColor * diffuseFactor1;
                    vec3 diffuseLightColor2 = u_PointLightColor * diffuseFactor2;

                    // 物体在光照下的颜色 = （环境光照 + 漫反射光照） * 物体颜色。
                    vec3 blendColor = vec3(blendScreen(diffuseLightColor,diffuseLightColor1));
                    vec3 blendColor1 = vec3(blendScreen(blendColor,diffuseLightColor2));

                    float moveFactor = 0.6;
                    float fixedFactor = 0.8;

                    vec3 mixedLightColor = diffuseLightColor * moveFactor + blendColor1 * fixedFactor;

                    gl_FragColor = sample * vec4((ambient + mixedLightColor),1);

                }
            `;
			this.uniforms = {
				u_Resolution: [mapWidth, mapHeight],
				uSampler2: new Sprite(this.rootRenderTexture).texture,
				u_AmbientFactor: 0.03, //环境光强度
				u_AmbientLight: [1.0, 1.0, 1.0], //环境光颜色
				u_PointLightColor: [1.0, 1.0, 1.0], //点光源颜色
				u_PointLightPosition: [
					575.0 / mapWidth,
					375.0 / mapHeight,
					0.022,
				], //移动点光源位置
				u_PointLightPosition1: [
					1035.0 / mapWidth,
					875.0 / mapHeight,
					0.022,
				], //点光源位置
				u_PointLightPosition2: [
					2075.0 / mapWidth,
					1575.0 / mapHeight,
					0.022,
				], //点光源位置
			};

			const shader = new Shader.from(
				vertexSrc,
				fragmentSrc,
				this.uniforms,
			);
			const plain = new Mesh(this.plainGeometry, shader);
			plain.containsPoint = function () {
				return;
			};

			this.app.stage.addChild(plain);

			let index = 0;
			let frameData = PATH_INFO.armature[0].animation[0].bone.find(
				(val) => val.name == 'move',
			);
			let eachFramePos = getEachFrameData(frameData, { x: 0, y: 0 });

			this.app.ticker.add(() => {
				this.app.renderer.render(
					this.rootContainer,
					this.rootRenderTexture,
				);

				index++;
				if (index > eachFramePos.length - 1) index = 0;
				this.handleAnimation(index, eachFramePos);
			});
			this.addEvent();
		},
		addEvent() {
			this.app.stage.interactive = true;
			this.app.stage.buttonMode = true;

			this.app.stage.on('touchstart', (e) => this.onTouchStart(e));
			this.app.stage.on('touchmove', (e) => this.onTouchMove(e));
			this.app.stage.on('touchend', (e) => this.onTouchEnd(e));

			this.pkqSprite.interactive = true;
			this.pkqSprite.buttonMode = true;
			this.pkqSprite.on('tap', (e) => this.onSpriteTap(e));
		},
		onSpriteTap(e) {
			console.log('点击了sprite', e);
		},
		onTouchStart(e) {
			// 是否开始手势操作
			this.touchFlag = 1;

			// 当前点在stage中的位置
			let pointInStage = e.data.getLocalPosition(this.app.stage);
			if (this.touchesArr.length == 2) {
				this.touchesArr.shift();
			}
			this.touchesArr.push(pointInStage);

			const touchLenght = e.data.originalEvent.touches.length;
			if (touchLenght == 1) {
				// 拖动操作
				const { clientX, clientY } = e.data.originalEvent.touches[0];
				this.singleFingerPosition = {
					clientX,
					clientY,
				};

				// 当前stage的位移
				this.currentStagePosition = {
					x: this.app.stage.x,
					y: this.app.stage.y,
				};
			} else if (touchLenght == 2) {
				// 缩放操作

				// 记录两点的初始距离
				this.firstFingerPosition = {
					clientX: e.data.originalEvent.touches['0'].clientX,
					clientY: e.data.originalEvent.touches['0'].clientY,
				};
				this.secondFingerPositiion = {
					clientX: e.data.originalEvent.touches['1'].clientX,
					clientY: e.data.originalEvent.touches['1'].clientY,
				};

				this.initDistance = this.getFingersDistance(
					this.firstFingerPosition,
					this.secondFingerPositiion,
				);

				//修改pivot，并对position做相应的调整
				const centerPointInStage = {
					x: (this.touchesArr[0].x + this.touchesArr[1].x) / 2,
					y: (this.touchesArr[0].y + this.touchesArr[1].y) / 2,
				};

				// 新旧pivot的差
				const diffPivot = {
					x: centerPointInStage.x - this.app.stage.pivot.x,
					y: centerPointInStage.y - this.app.stage.pivot.y,
				};

				const oldPosition = {
					x: this.app.stage.x,
					y: this.app.stage.y,
				};

				// 当前stage的位移
				this.currentStagePosition = {
					x: oldPosition.x + diffPivot.x * this.stageScale,
					y: oldPosition.y + diffPivot.y * this.stageScale,
				};

				this.app.stage.pivot.set(
					centerPointInStage.x,
					centerPointInStage.y,
				);

				this.app.stage.position.set(
					this.currentStagePosition.x,
					this.currentStagePosition.y,
				);
			}
		},
		onTouchMove(e) {
			// return
			if (this.touchFlag === 0) return;

			const touchLenght = e.data.originalEvent.touches.length;

			if (touchLenght == 1) {
				// 拖动
				const { clientX, clientY } = e.data.originalEvent.touches[0];
				this.diffPosition = {
					clientX: clientX - this.singleFingerPosition.clientX,
					clientY: clientY - this.singleFingerPosition.clientY,
				};

				let newPositionInfo = {
					x: this.currentStagePosition.x + this.diffPosition.clientX,
					y: this.currentStagePosition.y + this.diffPosition.clientY,
				};

				// 判断拖动是否超出边界
				let boundaryInfo = this.judgeMoveBoundary(
					newPositionInfo,
					this.app.stage.pivot,
				);
				if (boundaryInfo.fixedX) {
					newPositionInfo.x = this.app.stage.x;
				}
				if (boundaryInfo.fixedY) {
					newPositionInfo.y = this.app.stage.y;
				}
				this.app.stage.position.set(
					newPositionInfo.x,
					newPositionInfo.y,
				);
			} else if (touchLenght == 2) {
				// 缩放
				// 实时的距离
				this.firstFingerPosition = {
					clientX: e.data.originalEvent.touches['0'].clientX,
					clientY: e.data.originalEvent.touches['0'].clientY,
				};
				this.secondFingerPositiion = {
					clientX: e.data.originalEvent.touches['1'].clientX,
					clientY: e.data.originalEvent.touches['1'].clientY,
				};

				this.currentDistance = this.getFingersDistance(
					this.firstFingerPosition,
					this.secondFingerPositiion,
				);

				this.stageScale =
					(this.currentScale * this.currentDistance) /
					this.initDistance;

				// 重新设置stage信息
				this.scaleBeforeChange = this.app.stage.scale.x;
				this.app.stage.scale.set(this.stageScale);

				// 锁边
				// 1.不能小于屏幕
				// 2.出现黑边自动位移

				const { width, height } = this.app.stage;

				if (width < window.innerWidth || height < window.innerHeight) {
					this.stageScale = this.scaleBeforeChange;
					this.app.stage.scale.set(this.stageScale);
				}

				// if(boundaryInfo.fixedX || boundaryInfo.fixedY){
				// this.lockedScale = true
				// this.app.stage.scale.set(this.scaleBeforeChange)
				// this.lockedScale = false
				// }
			}
		},
		onTouchEnd(e) {
			this.touchFlag = 0;
			// 松手后判断是否有黑边
			let position = this.app.stage.position;
			let pivot = this.app.stage.pivot;
			let boundaryInfo = this.judgeMoveBoundary(
				this.app.stage.position,
				this.app.stage.pivot,
			);

			if (boundaryInfo.fixedX) {
				//判断贴合左边还是右边
				const x = position.x - pivot.x * this.stageScale;
				const awayLeft = x;
				const awayRight =
					window.innerWidth - mapWidth * this.stageScale - x;

				if (awayLeft < 0) {
					// 贴右边
					this.app.stage.position.x += awayRight;
				} else {
					// 贴左边
					this.app.stage.position.x -= awayLeft;
				}
			}

			if (boundaryInfo.fixedY) {
				// 判断贴合上边还是下边
				const y = position.y - pivot.y * this.stageScale;
				const awayTop = y;
				const awayBottom =
					window.innerHeight - mapHeight * this.stageScale - y;

				if (awayTop < 0) {
					// 贴下边
					this.app.stage.position.y += awayBottom;
				} else {
					// 贴上边
					this.app.stage.position.y -= awayTop;
				}
			}

			this.currentScale = this.app.stage.scale.x;
		},
		handleAnimation(index, eachFramePos) {
			let spriteWidth = this.pkqSprite.width;
			let spriteHeight = this.pkqSprite.height;
			this.pkqSprite.position.set(
				eachFramePos[index].x - spriteWidth / 2,
				eachFramePos[index].y - spriteHeight / 2,
			);

			// 获取光源的世界坐标系，转换到设备坐标系
			this.handleLightPosition(this.pkqSprite, spriteWidth, spriteHeight);
		},

		handleLightPosition(sprite, width, height) {
			const { tx, ty } = sprite.transform.worldTransform;

			this.uniforms.u_PointLightPosition = [
				(tx + width / 2) / mapWidth,
				(ty + height / 2) / mapHeight / (mapWidth / mapHeight),
				0.022,
			];
		},

		// 设置场景缩放率，偏移，缩放远点
		setMapInfo(scale, positionInfo, pivotInfo) {
			// 地图缩放率
			this.app.stage.scale.set(scale);
			// 地图位移
			this.app.stage.position.set(positionInfo.x, positionInfo.y);
			// 地图缩放原点
			this.app.stage.pivot.set(pivotInfo.x / scale, pivotInfo.y / scale);
		},

		// 拖动边界
		judgeMoveBoundary(position, pivot) {
			const x = position.x - pivot.x * this.stageScale;
			const y = position.y - pivot.y * this.stageScale;
			let boundaryInfo = {
				fixedX: false,
				fixedY: false,
			};
			if (x > 0) {
				// 左边出界
				boundaryInfo.fixedX = true;
			}
			if (x < window.innerWidth - mapWidth * this.stageScale) {
				// 右边出界
				boundaryInfo.fixedX = true;
			}
			if (y > 0) {
				// 上边出界
				boundaryInfo.fixedY = true;
			}
			if (y < window.innerHeight - mapHeight * this.stageScale) {
				// 下边出界
				boundaryInfo.fixedY = true;
			}

			return boundaryInfo;
		},

		// 计算双指间距离
		getFingersDistance(first, second) {
			let xDis = Math.abs(first.clientX - second.clientX);
			let yDis = Math.abs(first.clientY - second.clientY);
			return Math.sqrt(Math.pow(xDis, 2) + Math.pow(yDis, 2));
		},
	},
};
</script>
<style lang="less" scoped>
#root {
	position: fixed;
	width: 100%;
	height: 100%;
	overflow: hidden;
}
</style>
