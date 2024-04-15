import PouchDB from 'pouchdb';
interface Glyph {
    image: string | null;
    name: string;
    description: string | null;
    classification: string;
    width: string | number | [number, number] | [number, number, number];
    mei: string;
}

export type GlyphArray = Glyph[];

/** Type definitions for Cress */
export type AllDocs = {
  total_rows?: number,
  rows?: {
    doc?: PouchDB.Core.ExistingDocument<PouchDB.Core.AllDocsMeta> & { type?: string; name?: string; };
    id: string;
    key: string;
    value: {
      rev: string;
      deleted?: boolean;
    };
  }[];
};

export type Doc = {
  _id: string,
  name: string,
  _attachments: {
    glyphs: {
      content_type: string,
      data: Blob
    }
  },
};

export type uploadsInfo = {
  id: string;
  name: string;
}[];

/** An <svg> element from any DOM queries */
export type HTMLSVGElement = HTMLElement & SVGSVGElement;
