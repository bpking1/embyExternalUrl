// @author: Chen3861229
// @date: 2024-08-16

const SUBS_CODEC_ENUM = {
  srt: "srt",
  ass: "ass",
  ssa: "ssa",
  subrip: "subrip",
  webvtt: "webvtt",
};

// extract audio, video and subtitles
function parseM3U8(content) {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line);
  const streams = [];
  const audios = [];
  const subtitles = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
      const bandwidthMatch = lines[i].match(/BANDWIDTH=(\d+)/);
      const resolutionMatch = lines[i].match(/RESOLUTION=\d+x(\d+)/);
      const nameMatch = lines[i].match(/NAME="([^"]+)"/);
      const url = lines[i + 1];

      if (bandwidthMatch && resolutionMatch && nameMatch && url) {
        // const bandwidth = bandwidthMatch[1];
        const bandwidth = parseInt(bandwidthMatch[1]) || 0;
        const resolution = resolutionMatch[1];
        const name = nameMatch[1];
        streams.push({
          bandwidth,
          resolution,
          url,
          quality: name
        });
      }
    } else if (lines[i].startsWith('#EXT-X-MEDIA:TYPE=AUDIO')) {
      const nameMatch = lines[i].match(/NAME="([^"]+)"/);
      const languageMatch = lines[i].match(/LANGUAGE="([^"]+)"/);
      const defaultMatch = lines[i].match(/DEFAULT=(YES|NO)/);
      const uriMatch = lines[i].match(/URI="([^"]+)"/);

      if (nameMatch && languageMatch && defaultMatch && uriMatch) {
        const name = nameMatch[1];
        const language = languageMatch[1];
        const isDefault = defaultMatch[1] === 'YES';
        const url = uriMatch[1];
        audios.push({
          name,
          language,
          isDefault,
          url
        });
      }
    }
  }

  return { streams, audios, subtitles };
}

function subCodecConvert(data, sourceCodec, targetCodec) {
  if (!targetCodec) { targetCodec = SUBS_CODEC_ENUM.webvtt; }
  let rvt = "";
  if (sourceCodec === SUBS_CODEC_ENUM.srt && targetCodec === SUBS_CODEC_ENUM.webvtt) {
    rvt = srt2webvtt(data);
  }
  return rvt;
}

// copy from https://github.com/silviapfeiffer/silviapfeiffer.github.io/blob/master/index.html
// It's too complicated, it can be optimized
function srt2webvtt(data) {
  // remove dos newlines, trim white space start and end
  const srt = data.replace(/\r+/g, '').replace(/^\s+|\s+$/g, '');
  // get cues
  const cuelist = srt.split('\n\n');
  let rvt = "";
  if (cuelist.length > 0) {
    rvt += "WEBVTT\n\n";
    for (let i = 0; i < cuelist.length; i = i + 1) {
      rvt += convertSrtCue(cuelist[i]);
    }
  }
  return rvt;
}

function convertSrtCue(caption) {
  let cue = "";
  const s = caption.split(/\n/);
  // concatenate muilt-line string separated in array into one
  while (s.length > 3) {
      for (let i = 3; i < s.length; i++) {
          s[2] += "\n" + s[i]
      }
      s.splice(3, s.length - 3);
  }
  let line = 0;
  // detect identifier
  if (!s[0].match(/\d+:\d+:\d+/) && s[1].match(/\d+:\d+:\d+/)) {
    cue += s[0].match(/\w+/) + "\n";
    line += 1;
  }
  // get time strings
  if (s[line].match(/\d+:\d+:\d+/)) {
    // convert time string
    const m = s[1].match(/(\d+):(\d+):(\d+)(?:,(\d+))?\s*--?>\s*(\d+):(\d+):(\d+)(?:,(\d+))?/);
    if (m) {
      cue += m[1]+":"+m[2]+":"+m[3]+"."+m[4]+" --> "
            +m[5]+":"+m[6]+":"+m[7]+"."+m[8]+"\n";
      line += 1;
    } else {
      // Unrecognized timestring
      return "";
    }
  } else {
    // file format error or comment lines
    return "";
  }
  // get cue text
  if (s[line]) {
    cue += s[line] + "\n\n";
  }
  return cue;
}

export default {
  SUBS_CODEC_ENUM,
  parseM3U8,
  subCodecConvert,
}