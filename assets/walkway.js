function createWalkway(section, unit) {
  const track = section.querySelector(".walkway");
  const guide = section.querySelector(".walk-guide");
  const previousButton = guide.querySelector("[data-walk-previous]");
  const nextButton = guide.querySelector("[data-walk-next]");
  const count = guide.querySelector(".walk-count");
  const status = section.querySelector("[data-walk-status]");
  const emptyMessage = section.querySelector(".room-empty");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let slides = [];
  let activeIndex = -1;
  let label = "";
  let scrollPause;
  let drag = null;
  let ignoreClickUntil = 0;

  function bayPosition(index) {
    const { bay } = slides[index];
    return bay.offsetLeft - (track.clientWidth - bay.offsetWidth) / 2;
  }

  function nearestBay() {
    const position = track.scrollLeft;
    let closest = 0;
    let shortest = Infinity;
    for (const index of slides.keys()) {
      const distance = Math.abs(bayPosition(index) - position);
      if (distance < shortest) {
        closest = index;
        shortest = distance;
      }
    }
    return closest;
  }

  function setSlideState(slide, selected) {
    slide.bay.classList.toggle("is-current", selected);
    if (!slide.frame) return;
    slide.frame.tabIndex = selected ? 0 : -1;
    if (selected) slide.frame.setAttribute("aria-haspopup", "dialog");
    else slide.frame.removeAttribute("aria-haspopup");
    slide.frame.setAttribute("aria-label", `〈${slide.title}〉 ${selected ? "크게 보기" : "관람하기"}`);
  }

  function showPosition(index) {
    if (index === activeIndex) return;
    const previous = slides[activeIndex];
    const selected = slides[index];
    const restoreFrameFocus = previous?.frame === document.activeElement;

    if (previous) setSlideState(previous, false);
    activeIndex = index;
    setSlideState(selected, true);
    previousButton.setAttribute("aria-disabled", String(index === 0));
    nextButton.setAttribute("aria-disabled", String(index === slides.length - 1));
    count.textContent = `${index + 1} / ${slides.length}`;
    status.textContent = `${label}. ${slides.length}${unit} 중 ${index + 1}번째. ${selected.title}`;
    if (restoreFrameFocus) selected.frame?.focus({ preventScroll: true });
  }

  function goTo(index, animate = true) {
    if (!slides.length) return;
    const target = Math.max(0, Math.min(index, slides.length - 1));
    showPosition(target);
    track.scrollTo({
      left: bayPosition(target),
      behavior: animate && !reducedMotion.matches ? "smooth" : "auto"
    });
  }

  function move(offset) {
    const target = activeIndex + offset;
    if (target >= 0 && target < slides.length) goTo(target);
  }

  function finishDrag(event) {
    if (drag?.pointer !== event.pointerId) return;
    const moved = drag.moved;
    drag = null;
    if (!moved) return;

    const closest = nearestBay();
    ignoreClickUntil = performance.now() + 160;
    track.classList.remove("is-dragging");
    goTo(closest);
  }

  function show(newSlides, newLabel) {
    clearTimeout(scrollPause);
    const pointer = drag?.pointer;
    drag = null;
    if (pointer !== undefined && track.hasPointerCapture(pointer)) track.releasePointerCapture(pointer);
    track.classList.remove("is-dragging");
    ignoreClickUntil = 0;

    slides = newSlides;
    label = newLabel;
    activeIndex = -1;
    slides.forEach((slide) => setSlideState(slide, false));
    track.replaceChildren(...slides.map(({ bay }) => bay));
    track.setAttribute("aria-label", label);

    const hasSlides = slides.length > 0;
    guide.hidden = !hasSlides;
    track.hidden = !hasSlides;
    if (emptyMessage) emptyMessage.hidden = hasSlides;
    if (hasSlides) goTo(0, false);
    else status.textContent = `${label}. 전시를 준비하고 있습니다.`;
  }

  previousButton.addEventListener("click", () => move(-1));
  nextButton.addEventListener("click", () => move(1));

  section.addEventListener("keydown", (event) => {
    if (!slides.length || event.altKey || event.ctrlKey || event.metaKey || event.target.closest(".room-picker")) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    move(event.key === "ArrowLeft" ? -1 : 1);
  });

  track.addEventListener("scroll", () => {
    clearTimeout(scrollPause);
    scrollPause = setTimeout(() => {
      if (slides.length && !drag?.moved) showPosition(nearestBay());
    }, 140);
  }, { passive: true });

  new ResizeObserver(() => {
    if (!drag?.moved) goTo(activeIndex, false);
  }).observe(track);

  track.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    drag = { pointer: event.pointerId, startX: event.clientX, scroll: track.scrollLeft, moved: false };
  });

  track.addEventListener("pointermove", (event) => {
    if (drag?.pointer !== event.pointerId || !(event.buttons & 1)) return;
    const distance = event.clientX - drag.startX;
    if (!drag.moved) {
      if (Math.abs(distance) < 7) return;
      drag.moved = true;
      track.setPointerCapture(event.pointerId);
      track.classList.add("is-dragging");
    }
    track.scrollLeft = drag.scroll - distance;
  });

  for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
    track.addEventListener(eventName, finishDrag);
  }
  track.addEventListener("click", (event) => {
    if (event.detail && performance.now() < ignoreClickUntil) event.stopPropagation();
  }, true);

  return {
    show,
    goTo,
    get index() { return activeIndex; }
  };
}
