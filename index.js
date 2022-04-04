const events = require('events');
const fs = require('fs');
const fsPromises = require('fs/promises');
const os = require('os');
const path = require('path');
const readline = require('readline');
const yaml = require('yaml');

// Read the index file into JSON.
const readIndex = async file => {
  const contents = await fs.readFile(file, 'utf-8');
  return JSON.parse(contents);
}

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

/// Get the latest modification time for a stat object.
const getStatUpdated = stat => {
  if (!stat.isFile()) {
    throw new Error('Got directory in notes.');
  }
  return stat.ctime.toISOString()
};

const stat = file => getStatUpdated(fs.statSync(file));
const fstat = fd => getStatUpdated(fs.fstatSync(fd));

// Extract the metadata for the index entry from a file descriptor.
const getMetadataFd = async fd => {
  const updated = fstat(fd);
  const metadata = await readMetadata(fd);

  return {
    updated,
    ...metadata,
  };
}

// Extract the metadata for the index entry from a file.
const getMetadata = async file => {
  let tries = 0;
  while (tries <= 3) {
    const fd = fs.openSync(file, 'r');
    try {
      const metadata = await getMetadataFd(fd);
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
  const indexPath = path.join(os.homedir(), 'Desktop', 'index.json');

  try {
    // Need to read index, and update it.
    Object.assign(index, JSON.parse(fs.readFileSync(indexPath)));
    const newValues = {}
    for (const [basename, metadata] of Object.entries(index)) {
      const file = path.join(notesDir, basename);
      const updated = stat(file);
      if (updated != metadata.updated) {
        newValues[basename] = await getMetadata(file);
      }
    }
    Object.assign(index, newValues);

    // Write out index to file if any values changed.
    if (Object.keys(newValues).length != 0) {
      fs.writeFileSync(indexPath, JSON.stringify(index));
    }
  } catch (_) {
    // No index, create it from every file.
    const files = await fsPromises.readdir(notesDir);
    for (const basename of files) {
      const file = path.join(notesDir, basename);
      const metadata = await getMetadata(file);
      index[basename] = metadata;
    };

    // Write out index to file.
    fs.writeFileSync(indexPath, JSON.stringify(index));
  }
})();


