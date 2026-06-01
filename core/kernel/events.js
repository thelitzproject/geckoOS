/**
 * Lightweight typed event bus for inter-subsystem communication.
 */
export class EventBus {
  #handlers = new Map();

  on(event, handler) {
    if (!this.#handlers.has(event)) this.#handlers.set(event, new Set());
    this.#handlers.get(event).add(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    const wrapper = (...args) => { handler(...args); this.off(event, wrapper); };
    return this.on(event, wrapper);
  }

  off(event, handler) {
    this.#handlers.get(event)?.delete(handler);
  }

  emit(event, ...args) {
    this.#handlers.get(event)?.forEach(h => {
      try { h(...args); } catch (e) { console.error(`[EventBus] Error in "${event}" handler:`, e); }
    });
    // Wildcard listeners
    this.#handlers.get('*')?.forEach(h => {
      try { h(event, ...args); } catch (e) { console.error(`[EventBus] Error in wildcard handler:`, e); }
    });
  }

  removeAll(event) {
    if (event) this.#handlers.delete(event);
    else this.#handlers.clear();
  }
}
