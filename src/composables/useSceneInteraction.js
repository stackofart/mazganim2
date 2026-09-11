import { computed, onMounted, onUnmounted, ref } from "vue";
import { proximityPose, sceneState } from "../scene-state.js";

export function useSceneInteraction(button) {
  const pointer = ref({ near: false, progress: 0 });
  const focused = ref(false), hovered = ref(false), leaving = ref(false);
  const pose = computed(() => sceneState({ ...pointer.value, focused: focused.value, hovered: hovered.value, leaving: leaving.value }));
  let pointerMedia, frame, latestPoint;

  function resetPointer() {
    cancelAnimationFrame(frame);
    frame = undefined;
    latestPoint = undefined;
    pointer.value = { near: false, progress: 0 };
    hovered.value = false;
  }
  function move(event) {
    if (!pointerMedia?.matches || event.pointerType === "touch" || !button.value) return;
    latestPoint = { x: event.clientX, y: event.clientY };
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = undefined;
      if (button.value && latestPoint) pointer.value = proximityPose(latestPoint, button.value.getBoundingClientRect(), pointer.value.near);
    });
  }
  function enter(event) {
    if (pointerMedia?.matches && event.pointerType !== "touch") hovered.value = true;
  }
  function focus(event) {
    // A tap may focus a link too; the separate click action handles that case.
    focused.value = event.target.matches(":focus-visible");
  }
  function blur() { focused.value = false; }
  function depart() { leaving.value = true; }
  function returnToPage() {
    if (document.visibilityState !== "visible") return;
    leaving.value = false;
    resetPointer();
    focused.value = Boolean(button.value?.matches(":focus-visible"));
  }
  onMounted(() => {
    pointerMedia = window.matchMedia("(hover: hover) and (pointer: fine)");
    pointerMedia.addEventListener("change", resetPointer);
    window.addEventListener("blur", resetPointer);
    window.addEventListener("focus", returnToPage);
    window.addEventListener("pageshow", returnToPage);
    window.addEventListener("scroll", resetPointer, { passive: true });
    document.addEventListener("visibilitychange", returnToPage);
  });
  onUnmounted(() => {
    cancelAnimationFrame(frame);
    pointerMedia?.removeEventListener("change", resetPointer);
    window.removeEventListener("blur", resetPointer);
    window.removeEventListener("focus", returnToPage);
    window.removeEventListener("pageshow", returnToPage);
    window.removeEventListener("scroll", resetPointer);
    document.removeEventListener("visibilitychange", returnToPage);
  });
  return { pose, leaving, move, resetPointer, enter, focus, blur, depart, exit: () => { hovered.value = false; } };
}
