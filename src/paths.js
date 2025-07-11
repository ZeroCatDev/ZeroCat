import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = __dirname;

export default {
  ROOT_DIR,
  DATA_DIR: path.resolve(ROOT_DIR, 'data'),
  VIEWS_DIR: path.resolve(ROOT_DIR, 'views'),
};