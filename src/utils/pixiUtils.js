import { Sprite, Texture, Text, TilingSprite } from "pixi.js";
import {
    dbParseDragonBonesData,
    dbParseTextureAtlasData,
    dbBuildArmatureDisplay,
} from './dragonbonesExtend'


/**
 * 获取精灵元素
 * @param {*} data src/resources
 * @param {*} key  resources中的key
 * @return {*} 
 */
const getSprite = (data, key) => {
    if (data instanceof Object) {
        return new Sprite(data[key].texture)
    } else {
        return new Sprite(new Texture.from(data))
    }
}

const getTexture = (data) => {
    return new Texture.from(data)
}



const dragonbonesSprite = (resources, name) => {
    var texturePng = resources[`${name}TexturePng`].texture;
    var textureData = resources[`${name}TextureData`].data;
    var bonesData = resources[`${name}Bones`].data;
    dbParseDragonBonesData(bonesData);
    dbParseTextureAtlasData(textureData, texturePng);
    let sprite = dbBuildArmatureDisplay(
        bonesData.armature[0].name
    ); //构建骨骼动画
    return sprite
}

const getText = (text, style) => {
    return new Text(text,style);
}

const getStyle = (target, style) => {
    let styles = window.getComputedStyle(target, null);
    return styles.getPropertyValue(style);
}

const getTilingSprite = (src, width, height) => {
    return new TilingSprite(
        new Texture.from(src),
        width,
        height
    );
}

const spliteFn = (length, str) => {
    let reg = new RegExp('[^\n]{1,' + length + '}', 'g');
    let res = str.match(reg);
    return res.join('\n');
}




const getEachFrameData = (data, initPos) => {
    let frameData = data["frame"];
    let positionArr = [];
    frameData.map((value, index) => {
      let { transform, duration } = value;
      if(!transform.x) transform.x = 0
      if(!transform.y) transform.y = 0
      // transform 在每一节点时的位置

      // 下一节点
      let nextNode = {};

      if (frameData[index + 1]) {
        nextNode = {
          x: frameData[index + 1].transform.x ? frameData[index + 1].transform.x : 0,
          y: frameData[index + 1].transform.y ? frameData[index + 1].transform.y : 0,
        };
      } else {
        nextNode = {
          x: frameData[0].transform.x || 0,
          y: frameData[0].transform.y || 0,
        };
      }


      let arr = [];
      let stepX = (nextNode.x - transform.x) / (duration * 10);
      let stepY = (nextNode.y - transform.y) / (duration * 10);
      for (let i = 0; i < duration * 10; i++) {
        arr.push({
          x: stepX * i + transform.x + initPos.x ,
          y: stepY * i + transform.y + initPos.y ,
        });
      }

      positionArr.push(...arr);
    });
    return positionArr;
}


export {
    getSprite,
    dragonbonesSprite,
    getText,
    getStyle,
    getTilingSprite,
    spliteFn,
    getTexture,
    getEachFrameData
}