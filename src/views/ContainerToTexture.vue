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
			stagePosition: { x: 0, y: 0 },
			pkqSprite: null,
			stageScale: 0.3,
			uniforms: {},
			plainGeometry: null,
			rootRenderTexture: null,
			showMap: false,
			uniforms: {},
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

			const stage = (this.app.stage = new Stage());

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

			this.app.stage.scale.set(this.stageScale);
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
		},
		onTouchStart(e) {
			console.log('vv');
			const { clientX, clientY } = e.data.originalEvent.touches[0];
			this.initPosition = {
				clientX,
				clientY,
			};
			this.initStage = {
				x: this.app.stage.x,
				y: this.app.stage.y,
			};
		},
		onTouchMove(e) {
			const { clientX, clientY } = e.data.originalEvent.touches[0];
			this.diffPosition = {
				clientX: clientX - this.initPosition.clientX,
				clientY: clientY - this.initPosition.clientY,
			};

			this.app.stage.position.set(
				this.initStage.x + this.diffPosition.clientX,
				this.initStage.y + this.diffPosition.clientY,
			);

			this.stagePosition = {
				x: this.app.stage.position.x,
				y: this.app.stage.position.y,
			};
		},
		onTouchEnd(e) {
			//   const { position } = this.pkqSprite;
			// console.log(position.x,position.y,this.pkqSprite);
			//toLocal、toGlobal
			// console.log('worldTransform',this.pkqSprite.transform.worldTransform.tx,this.pkqSprite.transform.worldTransform.ty)
			// console.log('global',this.pkqSprite.toGlobal(pkg.position))
			// console.log('local',this.pkqSprite.toLocal(pkg.parent))
			// 输出stage的世界坐标
			//   console.log(
			//     "stage世界坐标",
			//     this.app.stage.position.x,
			//     this.app.stage.position.y
			//   );
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
				(tx+width/2) / mapWidth,
				(ty+height/2)/ mapHeight/(mapWidth/mapHeight),
				0.022,
			];
		},
	}
};
</script>

<style></style>
