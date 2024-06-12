/**
 * Manager for file uploading
 */
class UploadFileManager {
  private static instance: UploadFileManager;

  private allFiles = new Map<string, { file: File; count: number }>();
  private docs = new Array<doc>(); // filename, type

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static getInstance(): UploadFileManager {
    if (!UploadFileManager.instance) {
      UploadFileManager.instance = new UploadFileManager();
    }
    return UploadFileManager.instance;
  }

  public addFile(file: File): void {
    if (!this.allFiles.has(file.name)) {
      const newEntry = { file: file, count: 1 };
      this.allFiles.set(file.name, newEntry);
    } else {
      const existingCount = this.getFileCount(file.name);
      const updatedEntry = { file: file, count: existingCount + 1 };
      this.allFiles.set(file.name, updatedEntry);
    }
  }

  public getFile(key: string): File {
    if (this.allFiles.has(key)) {
      return this.allFiles.get(key).file;
    }
  }

  public removeFile(key: string): void {
    const count = this.getFileCount(key);
    if (count === 0) return;
    else if (count === 1) {
      this.allFiles.delete(key);
    } else {
      const updatedEntry = {
        file: this.allFiles.get(key).file,
        count: count - 1,
      };
      this.allFiles.set(key, updatedEntry);
    }
  }

  public getFileCount(key: string): number {
    if (this.allFiles.has(key)) {
      return this.allFiles.get(key).count;
    } else return 0;
  }

  public addDoc(name: string, ext: string, isCreated: boolean): void {
    const newDoc: doc = {
      filename: name,
      type: ext,
      isCreated: isCreated,
    };
    this.docs.push(newDoc);
  }

  public isCreatedDoc(filename: string): boolean {
    const doc = this.docs.find((doc) => doc.filename === filename);
    return doc ? doc.isCreated : false;
  }

  public removeDoc(filename: string): void {
    const idx = this.docs.findIndex((doc) => doc.filename === filename);
    this.docs.splice(idx, 1);
  }

  public getDocs(): [string, File, string][] {
    return this.docs.map((doc) => {
      const filename = doc.filename;
      const type = doc.type;
      return [filename, this.getFile(filename), type];
    });
  }

  public clear(): void {
    this.allFiles.clear();
    this.docs.splice(0);
  }

  public print(): void {
    console.log(this.allFiles);
    console.log(this.docs);
  }
}

export default UploadFileManager;

type doc = {
  filename: string;
  type: string;
  isCreated: boolean;
};
