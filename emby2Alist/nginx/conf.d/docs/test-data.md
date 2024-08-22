
# emby-v-media.js

#### 1.fetch115Hls masterPlaylistText
```log
#EXTM3U
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=1800000,RESOLUTION=1280x720,AUDIO="Audio-Group",NAME="HD"
https: //cpats01.115.com/2032827273f2509ec953cdcdf6bb2643/66BDE8C8/6CC0BBC7CEFCD1AA339F9CE64BE82E4249321148/6CC0BBC7CEFCD1AA339F9CE64BE82E4249321148_1280.m3u8?u=361327067&se=u,ua&s=104857600&ck=
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=3000000,RESOLUTION=1920x1080,AUDIO="Audio-Group",NAME="UD"
https: //cpats01.115.com/7b9da42ee9b6ef6d88b9cdc216b52f4a/66BDE8C8/6CC0BBC7CEFCD1AA339F9CE64BE82E4249321148/6CC0BBC7CEFCD1AA339F9CE64BE82E4249321148_1920.m3u8?u=361327067&se=u,ua&s=157286400&ck=
```

#### 2.fetch115Hls function result
```json
{
  "streams": [
    {
      "resolution": "720",
      "url": "https://cpats01.115.com/2809f2d1eef77d71beab670be626d566/66BE4AC2/6CC0BBC7CEFCD1AA339F9CE64BE82E4249321148/6CC0BBC7CEFCD1AA339F9CE64BE82E4249321148_1280.m3u8?u=361327067&se=u,ua&s=104857600&ck=",
      "quality": "HD"
    },
    {
      "resolution": "1080",
      "url": "https://cpats01.115.com/b3a68e1971bd46c58725c86228fde500/66BE4AC2/6CC0BBC7CEFCD1AA339F9CE64BE82E4249321148/6CC0BBC7CEFCD1AA339F9CE64BE82E4249321148_1920.m3u8?u=361327067&se=u,ua&s=157286400&ck=",
      "quality": "UD"
    }
  ],
  "audios": [],
  "subtitles": [
    {
      "sid": "41f2287f2634e9d8762104691de0c974builtin",
      "language": "",
      "title": "[内置字幕]简体",
      "url": "http://cpats01.115.com/43579af238305bcbec6af0df14d71e71/66BE4AC2/6CC0BBC7CEFCD1AA339F9CE64BE82E4249321148/6CC0BBC7CEFCD1AA339F9CE64BE82E4249321148_0.srt?u=0&t=33db561f2eca147c51b77f3b8dc2f18f",
      "type": "srt"
    },
    {
      "sid": "f2ac38e1122f83fa13f378abba2bc185builtin",
      "language": "",
      "title": "[内置字幕]繁体",
      "url": "http://cpats01.115.com/716ea709a65a436c7ad9c0eaecbb2aa8/66BE4AC2/6CC0BBC7CEFCD1AA339F9CE64BE82E4249321148/6CC0BBC7CEFCD1AA339F9CE64BE82E4249321148_1.srt?u=0&t=33db561f2eca147c51b77f3b8dc2f18f",
      "type": "srt"
    }
  ],
}
```

#### 3.fetch115Hls subtitle API result
```json
{
  "state": true,
  "error": "",
  "errNo": 0,
  "data": {
    "autoload": {
      "sid": "18df1b2ceef91541d3bc82c7a10c4249builtin",
      "language": "",
      "title": "[内置字幕]字幕1",
      "url": "http://cpats01.115.com/397c53d085d9804be5a35f60e10871d6/66BF8DB2/83C82F4C00A1349F53298119F408F6FAA6C5D678/83C82F4C00A1349F53298119F408F6FAA6C5D678_0.ass?u=0&t=33db561f2eca147c51b77f3b8dc2f18f",
      "type": "ass"
    },
    "list": [
      {
        "sid": "18df1b2ceef91541d3bc82c7a10c4249builtin",
        "language": "",
        "title": "[内置字幕]字幕1",
        "url": "http://cpats01.115.com/397c53d085d9804be5a35f60e10871d6/66BF8DB2/83C82F4C00A1349F53298119F408F6FAA6C5D678/83C82F4C00A1349F53298119F408F6FAA6C5D678_0.ass?u=0&t=33db561f2eca147c51b77f3b8dc2f18f",
        "type": "ass"
      },
      {
        "sid": "5ac9fb583be99c63415862771e2080fabuiltin",
        "language": "",
        "title": "[内置字幕]字幕2",
        "url": "http://cpats01.115.com/b0e55d33463c239e9d5bd2049ac2ccd1/66BF8DB2/83C82F4C00A1349F53298119F408F6FAA6C5D678/83C82F4C00A1349F53298119F408F6FAA6C5D678_1.ass?u=0&t=33db561f2eca147c51b77f3b8dc2f18f",
        "type": "ass"
      }
    ]
  }
}
```

#### 4.emby local media External subtitle type item
```json
{
  "Protocol": "File",
  "Id": "442550c9fb8501bf2e8d317495a04d26",
  "Path": "/AList/alias/xxx - S01E01 - 第1集.mkv",
  "Type": "Default",
  "Container": "mkv",
  "Size": 1091315571,
  "Name": "xxx - S01E01 - 第1集",
  "IsRemote": false,
  "HasMixedProtocols": false,
  "RunTimeTicks": 14119520000,
  "SupportsTranscoding": false,
  "SupportsDirectStream": true,
  "SupportsDirectPlay": true,
  "IsInfiniteStream": false,
  "RequiresOpening": false,
  "RequiresClosing": false,
  "RequiresLooping": false,
  "SupportsProbing": false,
  "MediaStreams": [
    {
      "Codec": "hevc",
      "TimeBase": "1/1000",
      "VideoRange": "SDR",
      "DisplayTitle": "1080p HEVC",
      "IsInterlaced": false,
      "BitRate": 6183301,
      "BitDepth": 10,
      "RefFrames": 1,
      "IsDefault": true,
      "IsForced": false,
      "IsHearingImpaired": false,
      "Height": 1080,
      "Width": 1920,
      "AverageFrameRate": 23.976025,
      "RealFrameRate": 23.976025,
      "Profile": "Main 10",
      "Type": "Video",
      "AspectRatio": "16:9",
      "Index": 0,
      "IsExternal": false,
      "IsTextSubtitleStream": false,
      "SupportsExternalStream": false,
      "Protocol": "File",
      "PixelFormat": "yuv420p10le",
      "Level": 120,
      "IsAnamorphic": false,
      "ExtendedVideoType": "None",
      "ExtendedVideoSubType": "None",
      "ExtendedVideoSubTypeDescription": "None",
      "AttachmentSize": 0
    },
    {
      "Codec": "flac",
      "TimeBase": "1/1000",
      "DisplayTitle": "FLAC stereo (默认)",
      "IsInterlaced": false,
      "ChannelLayout": "stereo",
      "BitDepth": 24,
      "Channels": 2,
      "SampleRate": 48000,
      "IsDefault": true,
      "IsForced": false,
      "IsHearingImpaired": false,
      "Type": "Audio",
      "Index": 1,
      "IsExternal": false,
      "IsTextSubtitleStream": false,
      "SupportsExternalStream": false,
      "Protocol": "File",
      "ExtendedVideoType": "None",
      "ExtendedVideoSubType": "None",
      "ExtendedVideoSubTypeDescription": "None",
      "AttachmentSize": 0
    },
    {
      "Codec": "ass",
      "Language": "chs",
      "DisplayTitle": "Chinese Simplified (ASS)",
      "DisplayLanguage": "Chinese Simplified",
      "IsInterlaced": false,
      "IsDefault": false,
      "IsForced": false,
      "IsHearingImpaired": false,
      "Type": "Subtitle",
      "Index": 2,
      "IsExternal": true,
      "DeliveryMethod": "External",
      "DeliveryUrl": "/Videos/284773/442550c9fb8501bf2e8d317495a04d26/Subtitles/2/0/Stream.ass?api_key=xxx",
      "IsExternalUrl": false,
      "IsTextSubtitleStream": true,
      "SupportsExternalStream": true,
      "Path": "/AList/alias/xxx - S01E01 - 第1集.chi.zh-cn.ass",
      "Protocol": "File",
      "ExtendedVideoType": "None",
      "ExtendedVideoSubType": "None",
      "ExtendedVideoSubTypeDescription": "None",
      "AttachmentSize": 0
    },
    {
      "Codec": "ass",
      "Language": "cht",
      "DisplayTitle": "Chinese Traditional (ASS)",
      "DisplayLanguage": "Chinese Traditional",
      "IsInterlaced": false,
      "IsDefault": false,
      "IsForced": false,
      "IsHearingImpaired": false,
      "Type": "Subtitle",
      "Index": 3,
      "IsExternal": true,
      "DeliveryMethod": "External",
      "DeliveryUrl": "/Videos/284773/442550c9fb8501bf2e8d317495a04d26/Subtitles/3/0/Stream.ass?api_key=xxx",
      "IsExternalUrl": false,
      "IsTextSubtitleStream": true,
      "SupportsExternalStream": true,
      "Path": "/AList/alias/xxx - S01E01 - 第1集.zh-tw.ass",
      "Protocol": "File",
      "ExtendedVideoType": "None",
      "ExtendedVideoSubType": "None",
      "ExtendedVideoSubTypeDescription": "None",
      "AttachmentSize": 0
    }
  ],
  "Formats": [],
  "Bitrate": 6183301,
  "RequiredHttpHeaders": {},
  "DirectStreamUrl": "/videos/284773/stream/xxx-%20S01E01%20-%20%E7%AC%AC1%E9%9B%86.mkv?UserId=ac0d220d548f43bbb73cf9b44b2ddf0e&IsPlayback=false&AutoOpenLiveStream=false&MaxStreamingBitrate=200000000&X-Emby-Client=Emby%20Web&X-Emby-Device-Name=Microsoft%20Edge%20Windows&X-Emby-Device-Id=2d427412-43e1-49e4-a1db-fa17c04d49db&X-Emby-Client-Version=4.8.8.0&X-Emby-Token=xxx&X-Emby-Language=zh-cn&reqformat=json&MediaSourceId=442550c9fb8501bf2e8d317495a04d26&PlaySessionId=51c79c1d3e504cc6a8cf2688700963fa&Static=true",
  "AddApiKeyToDirectStreamUrl": false,
  "ReadAtNativeFramerate": false,
  "DefaultAudioStreamIndex": 1,
  "DefaultSubtitleStreamIndex": 2,
  "ItemId": "284773",
  "XRouteMode": "redirect",
  "XOriginDirectStreamUrl": "/videos/284773/original.mkv?DeviceId=2d427412-43e1-49e4-a1db-fa17c04d49db&MediaSourceId=442550c9fb8501bf2e8d317495a04d26&PlaySessionId=51c79c1d3e504cc6a8cf2688700963fa&api_key=xxx",
  "XModifyDirectStreamUrlSuccess": true
}
```