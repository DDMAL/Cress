import { v4 as uuidv4 } from 'uuid';
import { IFolder, FileSystemTools } from '.';
import { fetchUploads } from '../Storage';

interface FileSystemProps {
  getRoot: () => Promise<IFolder>;
  setFileSystem: (root: IFolder) => boolean;
  getFileSystem: () => Promise<IFolder>;
  newTrash: (root: IFolder) => void;
}
  

// Manager is used for accessing local storage and tracking the position of current folder
export const FileSystemManager = (): FileSystemProps => {

  async function getRoot(): Promise<IFolder> { 
    return await getFileSystem();
  }

  // Save filesystem into local storage
  function setFileSystem(root: IFolder): boolean {
    try {
      window.localStorage.setItem('cress-fs', JSON.stringify(root));
    } catch (e) {
      console.error(e);
      window.alert('Error saving file system');
      return false;
    }
    return true;
  }

  // Load filesystem from local storage, creates new root if none exists
  async function getFileSystem(): Promise<IFolder> {
    try {
      const fs = window.localStorage.getItem('cress-fs');
            
      // if localstorage exists, load previous root
      if (fs) {
        const localFileSystem = JSON.parse(fs) as IFolder;
        return localFileSystem;
      }
      // else, create new root
      else {
        const root = FileSystemTools.createFolder('Home');
        loadSamples(root);
        newTrash(root);
        await loadPreviousUploads(root);
        setFileSystem(root);
        return root;
      }
    } catch (e) {
      console.error(e);
      window.alert('Error loading file system');
    }
  } 

  async function getFileNames(folderPath: string): Promise<string[]> {
    const response = await fetch(folderPath);
    const text = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    
    const files = Array.from(xml.querySelectorAll('a'));
    const fileNames: string[] = [];

    files.forEach(file => {
        const fileName = file.textContent || '';
        fileNames.push(fileName);
    });

    return fileNames;
  }

  // This next function is solely for loading samples into the root as a default for Cress
  function loadSamples(root: IFolder) {
    // Make sample entries
    getFileNames('samples/').then(samples => {
        const sampleEntries = samples.map(name => {
        const entry = FileSystemTools.createFile(name, uuidv4());
        FileSystemTools.addMetadata(entry, {document: 'sample', immutable: true });
        return entry;
      });

      // Make samples folder and add to root
      const samplesFolder = FileSystemTools.createFolder('Samples');
      // Add sample entries to samples folder
      sampleEntries.forEach((sample) => {
        FileSystemTools.addEntry(sample, samplesFolder);
      });
      FileSystemTools.addEntry(samplesFolder, root);
      FileSystemTools.addMetadata(samplesFolder, { immutable: true });

      return root;
    })
    
  }

  function newTrash(root: IFolder) {
    const trashFolder = FileSystemTools.createTrash('Trash');
    FileSystemTools.addEntry(trashFolder, root);
  }

  async function loadPreviousUploads(root: IFolder) {
    // Get previous uploads from local storage
    const uploads = await fetchUploads();

    // Make upload entries
    const uploadEntries = uploads.map((upload) => {
      return FileSystemTools.createFile(upload.name, upload.id);
    });

    uploadEntries.forEach((upload) => {
      FileSystemTools.addEntry(upload, root);
    });

    return root;
  }

  const FileSystemProps: FileSystemProps = {
    getRoot: getRoot,
    setFileSystem: setFileSystem,
    getFileSystem: getFileSystem,
    newTrash: newTrash,
  };

  return FileSystemProps;
};