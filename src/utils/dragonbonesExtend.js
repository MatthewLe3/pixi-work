import { Texture, Rectangle, Sprite, Graphics, BLEND_MODES, SimpleMesh, settings, Ticker, VERSION } from 'pixi.js'
const PIXI =  { Texture, Rectangle, Sprite, Graphics, BLEND_MODES, SimpleMesh, settings, Ticker, VERSION } 
window.PIXI = PIXI
const dragonBones = require('pixi5-dragonbones')

const dbParseDragonBonesData = (skeletonData) => {
    dragonBones.PixiFactory.factory.parseDragonBonesData(skeletonData)
}
const dbParseTextureAtlasData = (textureData, textureImg) => {
    dragonBones.PixiFactory.factory.parseTextureAtlasData(textureData, textureImg)
}
const dbBuildArmatureDisplay = (name) => {
    return dragonBones.PixiFactory.factory.buildArmatureDisplay(name)
}
export {
    dbParseDragonBonesData,
    dbParseTextureAtlasData,
    dbBuildArmatureDisplay,
    dragonBones
}

// todo 判断webpack对pixi是否是按需引用