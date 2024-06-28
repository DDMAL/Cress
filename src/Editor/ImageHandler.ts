import Handsontable from 'handsontable';

export class ImageHandler {
  private images: any[];

  constructor(images: any[]) {
    this.images = images;
  }

  // Image Handler Functions
  storeImages(inputImgHeader: string, body: any[]) {
    body.forEach((row, rowIndex) => {
      const base64Image = row[inputImgHeader];
      if (base64Image) {
        this.getImageDimensions(base64Image).then(([width, height]) => {
          this.images.push({
            image: base64Image,
            width,
            height,
            row: rowIndex,
          });
        });
      }
    });
  }

  // Get image dimensions
  getImageDimensions(base64String: string): Promise<[number, number]> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const maxWidth = 60;
      const maxHeight = 60;
      img.onload = () => {
        const widthRatio = maxWidth / img.width;
        const heightRatio = maxHeight / img.height;
        let ratio;
        if (img.width > maxWidth || img.height > maxHeight) {
          ratio = Math.min(widthRatio, heightRatio);
        } else {
          ratio = Math.max(widthRatio, heightRatio);
        }
        img.width *= ratio;
        img.height *= ratio;
        resolve([img.width, img.height]);
      };
      img.onerror = reject;
      img.src = base64String;
    });
  }

  // Image Renderer Functions
  imgRender(
    instance: Handsontable,
    td: HTMLElement,
    row: number,
    col: number,
    prop: string,
    value: any,
    cellProperties: Handsontable.CellProperties
  ) {
    Handsontable.dom.empty(td);

    if (value && (value.includes('http') || value.includes('base64'))) {
      const container = document.createElement('div');
      container.classList.add('img-cell-container');

      const imgContainer = document.createElement('div');
      imgContainer.classList.add('img-container');

      const img = this.createImageElement(value);
      const image = this.images.find((image) => image.row === row);
      img.style.width = image ? `${image.width}px` : '60px';
      img.style.height = image ? `${image.height}px` : '40px';
      imgContainer.appendChild(img);

      const resizeHandle = this.createResizeHandle();
      this.makeImageResizable(img, resizeHandle, row);
      imgContainer.appendChild(resizeHandle);

      container.appendChild(imgContainer);

      const buttons = this.createButtons(instance, row, col);
      container.appendChild(buttons);

      td.appendChild(container);
      cellProperties.readOnly = true;
    } else if (!value) {
      const input = this.handleImgUpload(instance, row, col);
      td.appendChild(input);
      cellProperties.readOnly = true;
    } else {
      td.innerText = value;
    }
    return td;
  }

  // Image Upload Functions
  handleImgUpload(instance: Handsontable, row: number, col: number) {
    const container = document.createElement('div');
    container.classList.add('upload-img-container');

    const uploadImgButton = document.createElement('button');
    uploadImgButton.classList.add('upload-img-btn');

    const uploadImgIcon = document.createElement('img');
    uploadImgIcon.src = './Cress-gh/assets/img/upload-img.svg';
    uploadImgIcon.alt = 'Upload';
    uploadImgButton.appendChild(uploadImgIcon);

    const imgInput = document.createElement('input');
    imgInput.type = 'file';
    imgInput.accept = 'image/*';
    imgInput.style.display = 'none';

    uploadImgButton.addEventListener('click', () => {
      imgInput.click();
    });

    imgInput.addEventListener('change', (event) => {
      const file = (event.target as HTMLInputElement).files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64String = e.target.result as string;
          instance.setDataAtCell(row, col, base64String);
          instance.render();
          this.getImageDimensions(base64String).then(([width, height]) => {
            this.images.push({ image: base64String, width, height, row });
          });
        };
        reader.readAsDataURL(file);
      }
    });

    container.appendChild(uploadImgButton);
    container.appendChild(imgInput);
    return container;
  }

  createImageElement(value: string) {
    const img = document.createElement('img');
    img.style.overflow = 'hidden';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.src = value;
    img.addEventListener('mousedown', (event) => {
      event.preventDefault();
    });
    return img;
  }

  createResizeHandle() {
    const resizeHandle = document.createElement('div');
    resizeHandle.style.width = '10px';
    resizeHandle.style.height = '10px';
    resizeHandle.style.backgroundColor = 'gray';
    resizeHandle.style.position = 'absolute';
    resizeHandle.style.right = '0';
    resizeHandle.style.bottom = '0';
    resizeHandle.style.cursor = 'se-resize';
    return resizeHandle;
  }

  makeImageResizable(
    img: HTMLImageElement,
    resizeHandle: HTMLElement,
    row: number
  ) {
    resizeHandle.addEventListener('mousedown', (event) => {
      event.preventDefault();
      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = img.offsetWidth;
      const startHeight = img.offsetHeight;

      const onMouseMove = (e: MouseEvent) => {
        const newWidth = startWidth + (e.clientX - startX);
        const newHeight = startHeight + (e.clientY - startY);
        img.style.width = `${newWidth}px`;
        img.style.height = `${newHeight}px`;
        const image = this.images.find((image) => image.row === row);
        if (image) {
          image.width = newWidth;
          image.height = newHeight;
        }
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  createButtons(instance: Handsontable, row: number, col: number) {
    const buttonContainer = document.createElement('div');
    buttonContainer.classList.add('img-btn-container');

    const deleteButton = document.createElement('button');
    deleteButton.classList.add('icon-btn');
    const deleteIcon = document.createElement('img');
    deleteIcon.src = './Cress-gh/assets/img/remove-doc.svg';
    deleteIcon.alt = 'Delete';
    deleteIcon.title = 'Delete Image';
    deleteButton.appendChild(deleteIcon);
    deleteButton.addEventListener('click', () => {
      instance.setDataAtCell(row, col, '');
      instance.render();
    });

    const changeButton = document.createElement('button');
    changeButton.classList.add('icon-btn');
    const changeIcon = document.createElement('img');
    changeIcon.src = './Cress-gh/assets/img/rename-doc.svg';
    changeIcon.alt = 'Change';
    changeIcon.title = 'Change Image';
    changeButton.appendChild(changeIcon);
    changeButton.addEventListener('click', () => {
      const changeInput = this.handleImgUpload(instance, row, col);
      changeInput.querySelector('input').click();
    });

    buttonContainer.appendChild(deleteButton);
    buttonContainer.appendChild(changeButton);

    return buttonContainer;
  }
}
