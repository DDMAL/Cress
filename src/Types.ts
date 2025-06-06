import PouchDB from 'pouchdb';

interface Glyph {
  imagePath: string | null;
  imageBinary: string | null;
  name: string;
  folio: string;
  descriptor: string | null;
  classification: string;
  width: string | number | [number, number] | [number, number, number];
  mei: string;
  review: string;
  dob: string;
  project: string;
}

export type GlyphArray = Glyph[];

export type CressDoc = {
  id: string;
  name: string;
  header: string[] | undefined;
  body: any[];
};

/** Type definitions for Cress */
export type AllDocs = {
  total_rows?: number;
  rows?: {
    doc?: PouchDB.Core.ExistingDocument<PouchDB.Core.AllDocsMeta> & {
      type?: string;
      name?: string;
    };
    id: string;
    key: string;
    value: {
      rev: string;
      deleted?: boolean;
    };
  }[];
};

export type Doc = {
  _id: string;
  name: string;
  _attachments: {
    table: {
      content_type: string;
      data: Blob;
    };
  };
};

export type UploadsInfo = {
  id: string;
  name: string;
}[];

export type validationStatus = 'unknown' | 'processing' | 'done';

/** An <svg> element from any DOM queries */
export type HTMLSVGElement = HTMLElement & SVGSVGElement;

export type NotificationType = 'default' | 'error' | 'warning' | 'success';

export type TableEvent =
  | 'afterChange'
  | 'afterColumnMove'
  | 'afterColumnSequenceChange'
  | 'afterCreateCol'
  | 'afterCreateRow'
  | 'afterCut'
  | 'afterRemoveCol'
  | 'afterRemoveRow'
  | 'afterRowMove'
  | 'afterRowSequenceChange';

export type MeiData = {
  mei: string;
  row: number;
  isValid: boolean | null;
  errorMsg: string | null;
}[];
