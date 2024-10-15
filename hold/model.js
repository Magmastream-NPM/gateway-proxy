class Identify {
  constructor(d) {
    this.d = new IdentifyInfo(d);
  }
}

class Resume {
  constructor(d) {
    this.d = new ResumeInfo(d);
  }
}

class IdentifyInfo {
  constructor({ compress = null, shard, token }) {
    this.compress = compress; // Optional
    this.shard = shard; // Expected to be an array of 2 numbers
    this.token = token;
  }
}

class ResumeInfo {
  constructor({ session_id, seq, token }) {
    this.session_id = session_id;
    this.seq = seq;
    this.token = token;
  }
}

class Ready {
  constructor(d) {
    this.d = d; // Assuming d is a plain JSON object
  }
}

// Utility function to parse JSON
function parseJson(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (err) {
    console.error("Failed to parse JSON:", err);
    return null;
  }
}

// Example usage
const identifyJson = `{
    "d": {
        "compress": true,
        "shard": [0, 2],
        "token": "your-token"
    }
}`;

const parsedIdentify = parseJson(identifyJson);
if (parsedIdentify) {
  const identify = new Identify(parsedIdentify.d);
  console.log(identify);
}

const resumeJson = `{
    "d": {
        "session_id": "your-session-id",
        "seq": 42,
        "token": "your-token"
    }
}`;

const parsedResume = parseJson(resumeJson);
if (parsedResume) {
  const resume = new Resume(parsedResume.d);
  console.log(resume);
}
