<script lang="ts">
  import {createEventDispatcher, onDestroy} from 'svelte';

  export type GsSelectOption = {
    value: string;
    label: string;
  };

  export let value = '';
  export let options: GsSelectOption[] = [];
  export let placeholder = 'Select';
  export let disabled = false;

  const dispatch = createEventDispatcher<{change: string; value: string}>();

  let open = false;
  let rootEl: HTMLDivElement | null = null;
  let internalValue = value;
  let displayLabel = placeholder;

  $: if (value !== internalValue) {
    internalValue = value;
  }
  $: displayLabel = options.find(option => option.value === internalValue)?.label ?? (internalValue || placeholder);

  function selectValue(nextValue: string): void {
    internalValue = nextValue;
    value = nextValue;
    open = false;
    dispatch('change', nextValue);
    dispatch('value', nextValue);
  }

  function toggleOpen(): void {
    if (disabled) return;
    open = !open;
  }

  function onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (!rootEl || !target) return;
    if (!rootEl.contains(target)) open = false;
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('click', onDocumentClick);
  }

  onDestroy(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', onDocumentClick);
    }
  });
</script>

<div class="gs-select" bind:this={rootEl}>
  {#key `${internalValue}::${displayLabel}`}
    <button
      type="button"
      class="gs-select-trigger"
      aria-expanded={open}
      on:click|stopPropagation={toggleOpen}
      {disabled}
    >
      <span>{displayLabel}</span>
      <span class="caret">▾</span>
    </button>
  {/key}
  {#if open}
    <div class="gs-select-menu">
      {#each options as option}
        <button
          type="button"
          class="gs-option"
          on:click|stopPropagation={() => selectValue(option.value)}
        >
          {option.label}
        </button>
      {/each}
    </div>
  {/if}
</div>
