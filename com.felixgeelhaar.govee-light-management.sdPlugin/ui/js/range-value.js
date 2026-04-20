/**
 * Shows the current value on sdpi-range sliders in real time.
 * Reaches into the shadow DOM to listen for native input events on the
 * underlying <input type="range">, then updates the sdpi-item label.
 *
 * When a slider has data-number-input, also attaches a compact number
 * input next to it for direct value entry (requested in #200). The two
 * controls stay in sync: typing updates the slider, dragging updates
 * the number. Both persist to the sdpi-setting via the slider's native
 * shadow-root input dispatch.
 */
(function () {
	function clamp(val, min, max) {
		if (typeof val !== "number" || Number.isNaN(val)) return null;
		if (typeof min === "number" && val < min) return min;
		if (typeof max === "number" && val > max) return max;
		return val;
	}

	function getNativeInput(range) {
		var shadow = range.shadowRoot;
		if (!shadow) return null;
		return shadow.querySelector("input[type=range]");
	}

	/**
	 * Persist a value through the slider's native input so SDPI saves it.
	 * Dispatching a bubbling input+change on the shadow-root input is how
	 * sdpi-range notices user changes.
	 */
	function setSliderValue(range, numericValue) {
		var nativeInput = getNativeInput(range);
		if (!nativeInput) return false;
		var str = String(numericValue);
		if (nativeInput.value === str) return true;
		nativeInput.value = str;
		nativeInput.dispatchEvent(new Event("input", { bubbles: true }));
		nativeInput.dispatchEvent(new Event("change", { bubbles: true }));
		return true;
	}

	function attachNumberInput(range, onValueChange) {
		if (range.dataset.numberInputAttached === "true") return null;
		var min = parseFloat(range.getAttribute("min"));
		var max = parseFloat(range.getAttribute("max"));
		var step = parseFloat(range.getAttribute("step")) || 1;

		var numberInput = document.createElement("input");
		numberInput.type = "number";
		numberInput.className = "range-number-input";
		if (!Number.isNaN(min)) numberInput.min = String(min);
		if (!Number.isNaN(max)) numberInput.max = String(max);
		numberInput.step = String(step);
		numberInput.inputMode = "numeric";
		numberInput.setAttribute("aria-label", (range.getAttribute("setting") || "value") + " value");

		// Wrap the slider + number in a flex container for alignment.
		var wrap = document.createElement("div");
		wrap.className = "range-with-number";
		var parent = range.parentNode;
		if (!parent) return null;
		parent.insertBefore(wrap, range);
		wrap.appendChild(range);
		wrap.appendChild(numberInput);

		range.dataset.numberInputAttached = "true";

		function commit(raw) {
			var parsed = parseFloat(raw);
			var clamped = clamp(parsed, min, max);
			if (clamped === null) return;
			if (!Number.isNaN(step) && step > 0) {
				clamped = Math.round(clamped / step) * step;
				// Re-clamp in case rounding pushed past max/min.
				clamped = clamp(clamped, min, max);
			}
			if (numberInput.value !== String(clamped)) {
				numberInput.value = String(clamped);
			}
			setSliderValue(range, clamped);
			if (typeof onValueChange === "function") onValueChange(String(clamped));
		}

		numberInput.addEventListener("change", function () {
			commit(numberInput.value);
		});
		numberInput.addEventListener("blur", function () {
			commit(numberInput.value);
		});
		numberInput.addEventListener("keydown", function (evt) {
			if (evt.key === "Enter") {
				evt.preventDefault();
				commit(numberInput.value);
				numberInput.blur();
			}
		});

		return {
			syncFromSlider: function (val) {
				if (val != null && val !== "" && document.activeElement !== numberInput) {
					numberInput.value = String(val);
				}
			},
		};
	}

	function init() {
		document.querySelectorAll("sdpi-range[data-suffix]").forEach(function (range) {
			var suffix = range.getAttribute("data-suffix") || "";
			var item = range.closest("sdpi-item");
			if (!item) return;

			var baseLabel = item.getAttribute("label") || "";
			var attached = false;
			var hasNumberInput = range.hasAttribute("data-number-input");
			var numberBridge = null;

			function update(val) {
				if (val != null && val !== "") {
					item.setAttribute("label", baseLabel + " \u00B7 " + val + suffix);
					if (numberBridge) numberBridge.syncFromSlider(val);
				}
			}

			function readValue() {
				// Prefer shadow DOM input value, fall back to component value
				var nativeInput = getNativeInput(range);
				if (nativeInput) return nativeInput.value;
				return range.value;
			}

			function tryAttach() {
				var nativeInput = getNativeInput(range);
				if (!nativeInput) return false;
				nativeInput.addEventListener("input", function () {
					update(nativeInput.value);
				});
				if (hasNumberInput && !numberBridge) {
					numberBridge = attachNumberInput(range, update);
					// Initial sync for newly-created number input.
					numberBridge.syncFromSlider(nativeInput.value);
				}
				return true;
			}

			// Keep trying to attach and read value until we succeed
			var attempts = 0;
			var poll = setInterval(function () {
				if (!attached) attached = tryAttach();
				var v = readValue();
				if (v != null && v !== "") {
					update(v);
					if (attached) clearInterval(poll);
				}
				if (++attempts > 30) clearInterval(poll);
			}, 100);

			// valuechange fires when SDPI loads saved settings
			range.addEventListener("valuechange", function () {
				update(range.value);
			});
		});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
