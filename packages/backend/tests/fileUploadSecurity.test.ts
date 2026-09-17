import request from 'supertest';
import express, { Request, Response } from 'express';
import { secureFileUpload, handleFileUploadError } from '../src/middleware/fileUploadSecurity';

// The upload filter is tested here rather than through the API because the
// filename is the thing under test, and form-data normalises it on the way out:
// asking supertest to attach '../../../etc/passwd.txt' actually sends
// 'passwd.txt', so the traversal never reaches the server. A hand-built
// multipart body puts the name on the wire exactly as written - which is what a
// real attacker would do, since nothing obliges a client to use a library.
const BOUNDARY = '----BomizzelTestBoundary';

const multipartBody = (filename: string, contentType: string, content = 'test content') =>
  [
    `--${BOUNDARY}`,
    `Content-Disposition: form-data; name="ticketId"`,
    '',
    '00000000-0000-4000-8000-000000000000',
    `--${BOUNDARY}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    `Content-Type: ${contentType}`,
    '',
    content,
    `--${BOUNDARY}--`,
    '',
  ].join('\r\n');

// The real route authenticates first, which needs a database. The filter itself
// does not, so mount it on its own app and let the handler report what arrived.
const app = express();
app.post(
  '/upload',
  ...secureFileUpload,
  (req: Request, res: Response) => res.status(201).json({ originalname: req.file?.originalname }),
  handleFileUploadError
);
app.use(handleFileUploadError);

const upload = (filename: string, contentType = 'text/plain') =>
  request(app)
    .post('/upload')
    .set('Content-Type', `multipart/form-data; boundary=${BOUNDARY}`)
    .send(multipartBody(filename, contentType));

describe('secureFileUpload', () => {
  it('accepts an ordinary file of an allowed type', async () => {
    const response = await upload('notes.txt');

    expect(response.status).toBe(201);
    expect(response.body.originalname).toBe('notes.txt');
  });

  it.each([
    ['../../../etc/passwd.txt', 'parent directory traversal'],
    ['..\\..\\windows\\system.txt', 'windows-style traversal'],
    ['subdir/notes.txt', 'a path separator'],
  ])('reduces %s (%s) to a name with no path in it', async (filename) => {
    // The directory component never survives the parse: busboy hands multer the
    // basename, for backslashes as well as forward ones. So the upload is
    // accepted and the name the rest of the system sees cannot point anywhere
    // but the upload directory. It also means the filter's own check for '/',
    // '\\' and '..' in originalname can never fire for a path - it is a second
    // line behind one that already holds. Assert the property, since that is
    // what has to stay true whichever layer enforces it.
    const response = await upload(filename);

    expect(response.status).toBe(201);
    expect(response.body.originalname).not.toContain('/');
    expect(response.body.originalname).not.toContain('\\');
    expect(response.body.originalname).not.toContain('..');
  });

  it('rejects a name containing .. that survives the parse', async () => {
    // '..txt' has no separator, so it arrives intact and the filter's own check
    // is what stops it.
    const response = await upload('..txt');

    expect(response.status).toBe(400);
  });

  it.each(['payload.php', 'script.sh', 'installer.exe', 'macro.js'])(
    'rejects the dangerous extension in %s',
    async (filename) => {
      // Declared as text/plain so the request gets past the MIME check and the
      // extension is what actually stops it.
      const response = await upload(filename);

      expect(response.status).toBe(400);
    }
  );

  it('rejects a type that is not on the allow-list', async () => {
    const response = await upload('thing.bin', 'application/octet-stream');

    expect(response.status).toBe(400);
  });
});
