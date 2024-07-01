import { v4 as uuidv4 } from 'uuid';
import { EntryType, IEntry, IFolder, IFile } from '.';

/*
 *   File System Functions that are used to create, move, and delete file system entries
 *   Does not depend on state
 */

interface responseProp {
  succeeded: boolean;
  error: string;
}

const createEntry = (
  name: string,
  type: EntryType,
  id: string,
  children?: IEntry[],
): IEntry => {
  const metadata = {};
  if (type === EntryType.File) return { name, type, id, metadata } as IEntry;
  else return { name, type, id, children, metadata } as IEntry;
};

const createFolder = (name: string): IFolder => {
  return createEntry(name, EntryType.Folder, uuidv4(), []) as IFolder;
};

const createTrash = (name: string): IFolder => {
  return createEntry(name, EntryType.Trash, uuidv4(), []) as IFolder;
};

const createFile = (name: string, id: string): IFile => {
  return createEntry(name, EntryType.File, id) as IFile;
};

function addMetadata(entry: IEntry, metadata: Record<string, unknown>): IEntry {
  Object.entries(metadata).forEach(([key, value]) => {
    entry.metadata[key] = value;
  });
  return entry;
}

function removeMetadata(entry: IEntry, keys: string[]): IEntry {
  keys.forEach((key) => {
    delete entry.metadata[key];
  });
  return entry;
}

/**
 * Checks if entry can be added to parent folder
 * @param entry
 * @param parent
 * @returns response object { succeeded: boolean, error: string }
 */
const canAddEntry = (entry: IEntry, parent: IFolder): responseProp => {
  const nameExists = parent.children.some((e) => e.name === entry.name);
  const isImmutable = parent.metadata['immutable'];

  const returnObj = { succeeded: false, error: '' };
  if (nameExists)
    returnObj.error = `Duplicate name: ${entry.name} already exists in ${parent.name}.`;
  else if (isImmutable) returnObj.error = `${parent.name} is immutable.`;
  else returnObj.succeeded = true;

  return returnObj;
};

/**
 * Checks if entry can be removed from parent folder
 * @param entry
 * @param parent
 * @returns response object { succeeded: boolean, error?: string }
 */
const canRemoveEntry = (entry: IEntry, parent: IFolder): responseProp => {
  const idx = parent.children.findIndex((e) => e.id === entry.id);
  const existsInParent = idx !== -1;
  const isImmutableParent = parent.metadata['immutable'];
  const isImmutableEntry = entry.metadata['immutable'];

  const returnObj = { succeeded: false, error: '' };
  if (!existsInParent)
    returnObj.error = `${entry.name} does not exist in ${parent.name}.`;
  else if (isImmutableParent) returnObj.error = `${parent.name} is immutable.`;
  else if (isImmutableEntry) returnObj.error = `${entry.name} is immutable.`;
  else returnObj.succeeded = true;

  return returnObj;
};

/**
 * Checks if entry can be moved from parent to newParent (no duplicate, mutable parents, entry exists)
 * @param entry
 * @param parent
 * @param newParent
 * @returns response object { succeeded: boolean, error: string }
 */
const canMoveEntry = (
  entry: IEntry,
  parent: IFolder,
  newParent: IFolder,
): responseProp => {
  // is A a child of B
  function isChildOf(a: IEntry, b: IFolder) {
    return b.children
      .filter((e) => e.type === EntryType.Folder)
      .map((c: IFolder) => {
        if (c === a) return true;
        else return isChildOf(a, c);
      })
      .some((e) => e === true);
  }

  const isSame = entry === newParent;
  const nameExists = newParent.children.some((e) => e.name === entry.name);
  const isImmutableParent = parent.metadata['immutable'];
  const isImmutableNewParent = newParent.metadata['immutable'];
  const existsInParent =
    parent.children.findIndex((e) => e.id === entry.id) !== -1;
  // if entry is a folder, check if newParent is a subfolder of entry
  const newParentIsChildOfEntry =
    entry.type == EntryType.Folder
      ? isChildOf(newParent, entry as IFolder)
      : false;

  const returnObj = { succeeded: false, error: '' };
  if (isSame) returnObj.error = `Cannot move ${entry.name} to itself.`;
  else if (nameExists)
    returnObj.error = `Duplicate name: ${entry.name} already exists in ${newParent.name}.`;
  else if (isImmutableParent) returnObj.error = `${parent.name} is immutable.`;
  else if (isImmutableNewParent)
    returnObj.error = `${newParent.name} is immutable.`;
  else if (!existsInParent)
    returnObj.error = `${entry.name} does not exist in ${parent.name}.`;
  else if (newParentIsChildOfEntry)
    returnObj.error = `Cannot move ${entry.name} into a its own subfolder, ${newParent.name}.`;
  else returnObj.succeeded = true;

  return returnObj;
};

/**
 * Checks if entry can be renamed (no duplicate)
 * @param entry
 * @param parent
 * @param newName
 * @returns response object { succeeded: boolean, error: string }
 */
const canRenameEntry = (
  entry: IEntry,
  parent: IFolder,
  newName: string,
): responseProp => {
  // Check if newName already exists in parent
  const nameExists = parent.children.some(
    (e, idx, arr) => e.name === entry.name && idx !== arr.indexOf(e),
  );

  const returnObj = { succeeded: false, error: '' };
  if (nameExists)
    returnObj.error = `Duplicate name: ${newName} already exists in ${parent.name}.`;
  else returnObj.succeeded = true;

  return returnObj;
};

/**
 * Adds entry to parent folder
 * @param entry
 * @param parent
 * @returns true if added, else false
 */
const addEntry = (entry: IEntry, parent: IFolder): boolean => {
  const { succeeded, error } = canAddEntry(entry, parent);
  if (succeeded) {
    // Add entry to parent, sort by alphanumerical and folders before files
    parent.children.push(entry);
    sortFolder(parent);
    return true;
  } else {
    console.error(error);
    return false;
  }
};

/**
 * Removes entry from parent folder
 * @param entry
 * @param parent
 * @param force force a removal
 * @returns true if removed, else false
 */
const removeEntry = (
  entry: IEntry,
  parent: IFolder,
  force = false,
): boolean => {
  const { succeeded, error } = canRemoveEntry(entry, parent);
  if (succeeded || force) {
    const idx = parent.children.indexOf(entry);
    parent.children.splice(idx, 1);
    return true;
  } else {
    console.error(error);
    return false;
  }
};

/**
 * Moves entry from parent to newParent
 * @param entry
 * @param parent
 * @param newParent
 * @returns true if moved, else false
 */
function moveEntry(
  entry: IEntry,
  parent: IFolder,
  newParent: IFolder,
): boolean {
  const moveResponse = canMoveEntry(entry, parent, newParent);

  if (moveResponse.succeeded) {
    const removed = removeEntry(entry, parent, true);
    if (removed) {
      const added = addEntry(entry, newParent);
      if (added) return true;
      else
        console.error(
          `Moving: failed to add ${entry.name} to ${newParent.name}`,
        );
    } else {
      console.error(
        `Moving: failed to remove ${entry.name} from ${parent.name}`,
      );
    }
  } else {
    console.error(moveResponse.error);
  }
  return false;
}

/**
 * Renames entry
 * @param entry
 * @param parent
 * @param newName
 * @returns true if renamed, else false
 */
const renameEntry = (
  entry: IEntry,
  parent: IFolder,
  newName: string,
): boolean => {
  const { succeeded, error } = canRenameEntry(entry, parent, newName);

  if (succeeded) {
    entry.name = newName;
    return true;
  } else {
    console.error(error);
    return false;
  }
};

const getAllNames = (folder: IFolder): string[] => {
  const names = folder.children.map((entry) => entry.name);
  return names;
};

/**
 *  Sorts folder by alphanumerical and folders before files
 * @param folder
 * @returns reference to same folder
 */
function sortFolder(folder: IFolder): IFolder {
  folder.children.sort((a, b) => a.name.localeCompare(b.name));
  folder.children.sort((a, b) => {
    if (a.type === EntryType.File && b.type === EntryType.Folder) return 1;
    else if (a.type === EntryType.Folder && b.type === EntryType.File)
      return -1;
    else return 0;
  });
  return folder;
}

export const FileSystemTools = {
  createFolder: createFolder,
  createTrash: createTrash,
  createFile: createFile,
  moveEntry: moveEntry,
  canAddEntry: canAddEntry,
  canRemoveEntry: canRemoveEntry,
  canMoveEntry: canMoveEntry,
  canRenameEntry: canRenameEntry,
  addEntry: addEntry,
  removeEntry: removeEntry,
  addMetadata: addMetadata,
  removeMetadata: removeMetadata,
  getAllNames: getAllNames,
  renameEntry: renameEntry,
};
