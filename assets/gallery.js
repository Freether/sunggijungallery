const assetDirectory = "./assets/";
const { rooms, works, books, life } = exhibition;
const byId = (id) => document.getElementById(id);
const worksById = new Map(works.map((work) => [work.id, work]));

const gallery = byId("gallery");
const roomPicker = byId("room-picker");
const roomDescription = byId("room-description");
const workTemplate = byId("work-template");
const photoWalkway = createWalkway(gallery, "점");
const dialog = byId("work-dialog");
const dialogImage = byId("dialog-image");
const dialogClose = byId("dialog-close");
const dialogNav = byId("dialog-nav");

let currentRoom = null;
let roomWorks = [];
let dialogItems = [];
let dialogIndex = 0;

function setExhibitImage(image, work, frame) {
  function setDimensions(width, height) {
    image.width = width;
    image.height = height;
    frame?.style.setProperty("--image-ratio", String(width / height));
  }

  if (work.width > 0 && work.height > 0) setDimensions(work.width, work.height);
  if (frame) {
    image.addEventListener("load", () => {
      const { naturalWidth, naturalHeight } = image;
      if (naturalWidth > 0 && naturalHeight > 0 &&
          (naturalWidth !== work.width || naturalHeight !== work.height)) {
        setDimensions(naturalWidth, naturalHeight);
      }
    }, { once: true });
  }
  image.src = assetDirectory + work.image;
}

function createDisplay(work, index) {
  const bay = workTemplate.content.firstElementChild.cloneNode(true);
  const frame = bay.querySelector("button");
  const image = bay.querySelector("img");
  setExhibitImage(image, work, frame);
  if (index === 0) {
    image.loading = "eager";
    image.fetchPriority = "high";
  }
  frame.addEventListener("click", () => {
    if (index === photoWalkway.index) openWork(roomWorks, index);
    else photoWalkway.goTo(index);
  });
  bay.querySelector(".work-title").textContent = work.title;
  bay.querySelector(".work-caption").textContent = work.caption;
  return { bay, frame, title: work.title };
}

function selectRoom(room) {
  if (room === currentRoom) return;
  currentRoom = room;
  roomWorks = room.workIds.map((id) => worksById.get(id)).filter(Boolean);
  gallery.dataset.room = room.id;
  roomDescription.textContent = room.description;

  for (const button of roomPicker.children) {
    button.setAttribute("aria-pressed", String(button.value === room.id));
  }

  photoWalkway.show(roomWorks.map(createDisplay), room.name);
}

for (const room of rooms) {
  const button = document.createElement("button");
  button.type = "button";
  button.value = room.id;
  button.textContent = room.name;
  button.setAttribute("aria-controls", "walkway");
  button.addEventListener("click", () => selectRoom(room));
  roomPicker.append(button);
}

if (rooms.length) {
  roomPicker.hidden = false;
  selectRoom(rooms[0]);
}

function showWork() {
  const work = dialogItems[dialogIndex];
  setExhibitImage(dialogImage, work);
  dialogImage.alt = work.alt || work.title;
  byId("dialog-title").textContent = work.title;
  byId("dialog-caption").textContent = [work.caption, work.note].filter(Boolean).join(" ");
  byId("dialog-position").textContent = `${dialogIndex + 1} / ${dialogItems.length}`;
}

function openWork(items, index) {
  dialogItems = items;
  dialogIndex = index;
  dialogNav.hidden = dialogItems.length < 2;
  showWork();
  dialog.showModal();
}

function moveWork(offset) {
  dialogIndex = (dialogIndex + offset + dialogItems.length) % dialogItems.length;
  showWork();
}

byId("previous-work").addEventListener("click", () => moveWork(-1));
byId("next-work").addEventListener("click", () => moveWork(1));
dialogClose.addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
dialog.addEventListener("keydown", (event) => {
  if (dialogItems.length < 2 || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    moveWork(event.key === "ArrowLeft" ? -1 : 1);
  }
});

const bookTemplate = byId("book-template");
const booksWithCovers = books.filter((book) => book.image);
const bookWalkway = createWalkway(byId("books"), "권");
const bookSlides = books.map((book, index) => {
  const bay = bookTemplate.content.firstElementChild.cloneNode(true);
  const cover = bay.querySelector(".book-cover");
  if (book.tone) cover.dataset.tone = book.tone;
  bay.querySelector(".book-title").textContent = book.title;
  bay.querySelector(".book-subtitle").textContent = book.subtitle || "";
  bay.querySelector(".book-caption").textContent = book.caption;

  if (book.image) {
    const frame = bay.querySelector(".book-cover-button");
    const image = frame.querySelector("img");
    setExhibitImage(image, book, cover);
    image.alt = book.alt || `〈${book.title}〉 표지`;
    if (index === 0) image.loading = "eager";
    frame.hidden = false;
    frame.addEventListener("click", () => {
      if (index === bookWalkway.index) openWork(booksWithCovers, booksWithCovers.indexOf(book));
      else bookWalkway.goTo(index);
    });
    cover.classList.add("has-image");
    bay.querySelector(".book-cover-copy").hidden = true;
    return { bay, frame, title: book.title };
  }

  return { bay, title: book.title };
});
bookWalkway.show(bookSlides, "베스트셀러 서가");

const archivePortrait = worksById.get(life.portrait);
if (archivePortrait) {
  const image = byId("life-image");
  setExhibitImage(image, archivePortrait);
  image.alt = archivePortrait.alt;
  byId("life-image-caption").textContent = `명화관 소장 〈${archivePortrait.title}〉`;
  byId("life-portrait").hidden = false;
}

const lifeTemplate = byId("life-template");
const timeline = byId("life-timeline");
for (const record of life.records) {
  const item = lifeTemplate.content.firstElementChild.cloneNode(true);
  item.querySelector(".life-period").textContent = record.period;
  item.querySelector(".life-event").textContent = record.title;
  item.querySelector(".life-record").textContent = record.text;
  timeline.append(item);
}
