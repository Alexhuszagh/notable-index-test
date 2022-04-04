const events = require('events');
const fs = require('fs');
const fsPromises = require('fs/promises');
const os = require('os');
const path = require('path');
const readline = require('readline');
const yaml = require('yaml');

// Extract the metadata from a file.
const readMetadata = async fd => {
  const lines = readline.createInterface({
    input: fs.createReadStream(null, {
      fd,
      autoClose: false,
    }),
    crlfDelay: Infinity
  });
  const metadata = [];
  let markers = 0;

  lines.on('line', line => {
    const trimmed = line.trim();
    if (trimmed === '---') {
      markers += 1;
      if (markers === 2) {
        lines.close();
        lines.removeAllListeners();
      }
    } else {
      metadata.push(trimmed);
    }
  });

  // Finished the file, no double markers.
  await events.once(lines, 'close');
  if (markers == 2) {
    return yaml.parse(metadata.join('\n'));
  } else {
    throw new Error('Invalid notes file.');
  }
}

// Extract the metadata for the index entry from a file.
const getMetadata = async file => {
  let tries = 0;
  while (tries <= 3) {
    const fd = fs.openSync(file, 'r');
    try {
      const metadata = await readMetadata(fd);
      fs.closeSync(fd);
      return metadata;
    } catch (_) {
      fs.closeSync(fd);
      tries += 1;
    }
  }

  throw new Error('Too many tries, failing');
}

(async function() {
  const index = {};
  const notesDir = path.join(os.homedir(), '.notable', 'notes');

  const files = await fsPromises.readdir(notesDir);
  for (const basename of files) {
    const file = path.join(notesDir, basename);
    const metadata = await getMetadata(file);
    index[basename] = metadata;
  };
})();
