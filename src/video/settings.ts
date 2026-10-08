export type VideoQuality = 'very-low' | 'low' | 'medium' | 'high' | 'very-high'

export interface VideoSettings {
  resolution: 512 | 1024
  frameRate: 30 | 60
  quality: VideoQuality
}
