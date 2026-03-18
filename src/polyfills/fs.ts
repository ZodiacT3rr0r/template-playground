type Callback<T> = (error: NodeJS.ErrnoException | null, result?: T) => void;

function createNotSupportedError(operation: string): NodeJS.ErrnoException {
  const error = new Error(`fs.${operation} is not supported in the browser runtime`) as NodeJS.ErrnoException;
  error.code = "ENOSYS";
  return error;
}

function callbackError<T>(operation: string, callback?: Callback<T>): void {
  if (typeof callback === "function") {
    callback(createNotSupportedError(operation));
  }
}

export function readdir(path: string, callback?: Callback<string[]>): void {
  void path;
  callbackError("readdir", callback);
}

export function stat(path: string, callback?: Callback<never>): void {
  void path;
  callbackError("stat", callback);
}

export function readdirSync(path: string): string[] {
  void path;
  return [];
}

export function statSync(path: string): never {
  void path;
  throw createNotSupportedError("statSync");
}

export function existsSync(path: string): boolean {
  void path;
  return false;
}

export function readFileSync(path: string): never {
  void path;
  throw createNotSupportedError("readFileSync");
}

export async function access(path: string): Promise<void> {
  void path;
  throw createNotSupportedError("access");
}

export async function readdirPromise(path: string): Promise<string[]> {
  void path;
  return [];
}

export async function statPromise(path: string): Promise<never> {
  void path;
  throw createNotSupportedError("stat");
}

export const promises = {
  access,
  readdir: readdirPromise,
  stat: statPromise,
};

const fsShim = {
  readdir,
  stat,
  readdirSync,
  statSync,
  existsSync,
  readFileSync,
  promises,
};

export default fsShim;
