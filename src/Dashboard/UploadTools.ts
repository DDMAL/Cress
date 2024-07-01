import { v4 as uuidv4 } from 'uuid';
import UploadFileManager from './UploadFileManager';
import { addDocument, createJson } from './Storage';
import { IFolder, FileSystemTools } from './FileSystem';

const fm = UploadFileManager.getInstance();

// Adds new files to uploading and filemanager, returns list of rejected files
export function addNewFiles(files: File[]): File[] {
  const file_container: HTMLDivElement =
    document.querySelector('#uploading_list');

  const rejectFiles: File[] = [];
  files.forEach((file) => {
    const ext = file.name.split('.').pop();

    if (['csv', 'xlsx', 'doc', 'docx'].includes(ext)) {
      const uploadingItem = createUploadingItem(file.name);
      file_container.appendChild(uploadingItem);
      fm.addFile(file);
      fm.addDoc(file.name, ext, false);
    } else {
      rejectFiles.push(file);
    }
  });
  return rejectFiles;
}

function createUploadingItem(filename: string): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'upload_item_container';

  const text = document.createElement('div');
  text.innerText = formatFilename(filename, 50);
  text.className = 'upload_item_name';

  const delBtn = document.createElement('img');
  delBtn.className = 'upload_del_btn';
  delBtn.src = `${__ASSET_PREFIX__}assets/img/remove-upload-doc.svg`;
  delBtn.title = 'delete';

  container.appendChild(text);
  container.appendChild(delBtn);

  delBtn.addEventListener('click', function () {
    container.remove();
  });

  return container;
}

export async function handleUploadAllDocuments(
  currentFolder: IFolder,
): Promise<unknown> {
  const promises = fm
    .getDocs()
    .map(async ([name, file, type]: [string, File, string]) => {
      const id = uuidv4();
      return await uploadDoc(id, name, file, type, currentFolder);
    });

  promises.map((p) =>
    Promise.resolve(p).then(
      (value) => ({ status: 'fulfilled', value }),
      (reason) => ({ status: 'rejected', reason }),
    ),
  );

  fm.clear();
  return Promise.all(promises);
}

async function uploadDoc(
  id: string,
  name: string,
  file: File,
  type: string,
  currentFolder: IFolder,
): Promise<boolean> {
  const newName = fnConflictHandler(
    name,
    FileSystemTools.getAllNames(currentFolder),
  );
  return (
    createJson(file, type)
      .then((jsonBlob) => {
        return addDocument(id, newName, jsonBlob);
      })
      // add to dashboard FileSystem
      .then((succeeded) => {
        if (succeeded) {
          const datetime = new Date().toLocaleString();
          const fileEntry = FileSystemTools.createFile(newName, id);
          const docEntry = FileSystemTools.addMetadata(fileEntry, {
            created_on: datetime,
          });
          const isAdded = FileSystemTools.addEntry(docEntry, currentFolder);
          return isAdded;
        } else {
          console.log('failed to upload doc: ' + name);
          return false;
        }
      })
  );
}

// Limit filename length
export function formatFilename(filename: string, maxLen: number): string {
  const chunkLen = Math.floor(maxLen / 2);
  const len = filename.length;
  if (len <= maxLen) return filename;
  else
    return `${filename.substring(0, chunkLen - 1)}...${filename.substring(
      len - chunkLen + 2,
      len,
    )}`;
}

// Renames file if there are naming conflicts, in the form of 'foobar (1)'
export function fnConflictHandler(
  filename: string,
  existingNames: string[],
): string {
  let newFilename = filename;
  let counter = 1;

  while (existingNames.includes(newFilename)) {
    newFilename = `${filename}(${counter})`;
    counter++;
  }
  return newFilename;
}
