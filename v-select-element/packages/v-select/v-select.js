import Emitter from "@/mixins/emitter";
import Focus from "@/mixins/focus";
import { debounce } from "throttle-debounce";
import Clickoutside from "@/utils/clickoutside";
import { addResizeListener, removeResizeListener } from "@/utils/resize-event";
import { getValueByPath, valueEquals, isIE, isEdge } from "@/utils/util";
import NavigationMixin from "@/mixins/navigation-mixin";
import { isKorean } from "@/utils/shared";
import "./select.css";

export default {
  mixins: [Emitter, Focus("reference"), NavigationMixin],

  name: "v-select",

  componentName: "ElSelect",

  inject: {
    elForm: {
      default: "",
    },

    elFormItem: {
      default: "",
    },
  },

  provide() {
    return {
      select: this,
    };
  },

  computed: {
    _elFormItemSize() {
      return (this.elFormItem || {}).elFormItemSize;
    },

    readonly() {
      return (
        !this.filterable ||
        this.multiple ||
        (!isIE() && !isEdge() && !this.visible)
      );
    },
    list() {
      const arr = this.localList.length ? this.localList : this.slotList;
      return arr.slice(this.startIndex, this.endIndex);
    },
    renderList() {
      return this.list.map((item, index) => {
        return (
          <div
            key={item.tag + index}
            data-index={index}
            class="list-item"
            style={{ height: this.listItemHeight + "px" }}
          >
            {item}
          </div>
        );
      });
    },
    showClose() {
      let hasValue = this.multiple
        ? Array.isArray(this.value) && this.value.length > 0
        : this.value !== undefined && this.value !== null && this.value !== "";
      let criteria =
        this.clearable &&
        !this.selectDisabled &&
        this.inputHovering &&
        hasValue;
      return criteria;
    },

    iconClass() {
        return this.remote && this.filterable ? '' : (this.visible ? 'arrow-up is-reverse' : 'arrow-up');
    },

    debounce() {
      return this.remote ? 300 : 0;
    },

    emptyText() {
      if (this.loading) {
        return this.loadingText || "加载中";
      } else {
        if (this.remote && this.query === "" && this.list.length === 0)
          return false;
        if (
          this.filterable &&
          this.query &&
          this.list.length > 0 &&
          this.filteredOptionsCount === 0
        ) {
          return this.noMatchText || "暂无数据";
        }
        if (this.list.length === 0) {
          return this.noDataText || "暂无数据";
        }
      }
      return null;
    },

    showNewOption() {
      let hasExistingOption = this.list
        .filter((option) => !option.created)
        .some((option) => option.currentLabel === this.query);
      return (
        this.filterable &&
        this.allowCreate &&
        this.query !== "" &&
        !hasExistingOption
      );
    },

    selectSize() {
      return this.size || this._elFormItemSize || (this.$ELEMENT || {}).size;
    },

    selectDisabled() {
      return this.disabled || (this.elForm || {}).disabled;
    },

    collapseTagSize() {
      return ["small", "mini"].indexOf(this.selectSize) > -1 ? "mini" : "small";
    },
    propPlaceholder() {
      return typeof this.placeholder !== "undefined"
        ? this.placeholder
        : "请选择";
    },
  },

  components: {},

  directives: { Clickoutside },

  props: {
    name: String,
    id: String,
    value: {
      required: true,
    },
    listItemHeight: {
      type: Number,
      default: 34,
    },
    itemCount:{
      type: Number,
      default: 15,
    },
    autocomplete: {
      type: String,
      default: "off",
    },
    /** @Deprecated in next major version */
    autoComplete: {
      type: String,
      validator(val) {
        process.env.NODE_ENV !== "production" &&
          console.warn(
            "[Element Warn][Select]'auto-complete' property will be deprecated in next major version. please use 'autocomplete' instead."
          );
        return true;
      },
    },
    automaticDropdown: Boolean,
    size: String,
    disabled: Boolean,
    clearable: Boolean,
    filterable: Boolean,
    allowCreate: Boolean,
    loading: Boolean,
    popperClass: String,
    remote: Boolean,
    loadingText: String,
    noMatchText: String,
    noDataText: String,
    remoteMethod: Function,
    filterMethod: Function,
    multiple: Boolean,
    multipleLimit: {
      type: Number,
      default: 0,
    },
    placeholder: {
      type: String,
      required: false,
    },
    defaultFirstOption: Boolean,
    reserveKeyword: Boolean,
    valueKey: {
      type: String,
      default: "value",
    },
    collapseTags: Boolean,
    popperAppendToBody: {
      type: Boolean,
      default: true,
    },
  },

  data() {
    return {
      options: [],
      cachedOptions: [],
      createdLabel: null,
      createdSelected: false,
      selected: this.multiple ? [] : {},
      inputLength: 20,
      inputWidth: 0,
      initialInputHeight: 0,
      cachedPlaceHolder: "",
      optionsCount: 0,
      filteredOptionsCount: 0,
      visible: false,
      softFocus: false,
      selectedLabel: "",
      hoverIndex: -1,
      query: "",
      previousQuery: null,
      inputHovering: false,
      currentPlaceholder: "",
      menuVisibleOnFocus: false,
      isOnComposition: false,
      isSilentBlur: false,
      slotList: [],
      scrollHeight: 0,
      startIndex: 0,
      endIndex: this.itemCount || 10,
      scrollTop: 0,
      localList: [],
    };
  },

  watch: {
    $slots: {
      handler(va, old) {
        this.init(va?.default || []);
      },
      immediate: true,
    },
    selectDisabled() {
      this.$nextTick(() => {
        this.resetInputHeight();
      });
    },

    propPlaceholder(val) {
      this.cachedPlaceHolder = this.currentPlaceholder = val;
    },

    value(val, oldVal) {
      if (this.multiple) {
        this.resetInputHeight();
        if (
          (val && val.length > 0) ||
          (this.$refs.input && this.query !== "")
        ) {
          this.currentPlaceholder = "";
        } else {
          this.currentPlaceholder = this.cachedPlaceHolder;
        }
        if (this.filterable && !this.reserveKeyword) {
          this.query = "";
          this.handleQueryChange(this.query);
        }
      }
      this.setSelected();
      if (this.filterable && !this.multiple) {
        this.inputLength = 20;
      }
      if (!valueEquals(val, oldVal)) {
        this.dispatch("ElFormItem", "el.form.change", val);
      }
    },

    visible(val) {
      if (!val) {
        this.broadcast("ElSelectDropdown", "destroyPopper");
        if (this.$refs.input) {
          this.$refs.input.blur();
        }
        this.query = "";
        this.previousQuery = null;
        this.selectedLabel = "";
        this.inputLength = 20;
        this.menuVisibleOnFocus = false;
        this.resetHoverIndex();
        this.$nextTick(() => {
          if (
            this.$refs.input &&
            this.$refs.input.value === "" &&
            this.selected.length === 0
          ) {
            this.currentPlaceholder = this.cachedPlaceHolder;
          }
        });
        if (!this.multiple) {
          if (this.selected) {
            if (
              this.filterable &&
              this.allowCreate &&
              this.createdSelected &&
              this.createdLabel
            ) {
              this.selectedLabel = this.createdLabel;
            } else {
              this.selectedLabel = this.selected.currentLabel;
            }
            if (this.filterable) this.query = this.selectedLabel;
          }

          if (this.filterable) {
            this.currentPlaceholder = this.cachedPlaceHolder;
          }
        }
      } else {
        this.broadcast("ElSelectDropdown", "updatePopper");
        if (this.filterable) {
          this.query = this.remote ? "" : this.selectedLabel;
          this.handleQueryChange(this.query);
          if (this.multiple) {
            this.$refs.input.focus();
          } else {
            if (!this.remote) {
              this.broadcast("ElOption", "queryChange", "");
              this.broadcast("ElOptionGroup", "queryChange");
            }

            if (this.selectedLabel) {
              this.currentPlaceholder = this.selectedLabel;
              this.selectedLabel = "";
            }
          }
        }
      }
      this.$emit("visible-change", val);
    },
  },

  methods: {
    init(slot = []) {
      this.slotList = slot;
      this.scrollHeight = slot.length * this.listItemHeight;
    },
    onScroll(e) {
      const scrollTop = e.target.scrollTop;
      this.scrollTop = scrollTop;
      this.startIndex = Math.floor(scrollTop / this.listItemHeight);
      this.endIndex = this.startIndex + this.itemCount;
    },
    handleNavigate(direction) {
      if (this.isOnComposition) return;

      this.navigateOptions(direction);
    },
    handleComposition(event) {
      const text = event.target.value;
      if (event.type === "compositionend") {
        this.isOnComposition = false;
        this.$nextTick((_) => this.handleQueryChange(text));
      } else {
        const lastCharacter = text[text.length - 1] || "";
        this.isOnComposition = !isKorean(lastCharacter);
      }
    },
    handleQueryChange(val) {
      // 判断当前输入是不是上一个查询 或者 正在拼装
      if (this.previousQuery === val || this.isOnComposition) return;
      // 如果有提供 自定义搜索方法 使用自定义方法
      if (
        this.previousQuery === null &&
        (typeof this.filterMethod === "function" ||
          typeof this.remoteMethod === "function")
      ) {
        this.previousQuery = val;
        return;
      }
      this.previousQuery = val;
      this.$nextTick(() => {
        if (this.visible) this.broadcast("ElSelectDropdown", "updatePopper");
      });
      this.hoverIndex = -1;
      // 多选 并且可搜索
      if (this.multiple && this.filterable) {
        this.$nextTick(() => {
          const length = this.$refs.input.value.length * 15 + 20;
          this.inputLength = this.collapseTags ? Math.min(50, length) : length;
          this.managePlaceholder();
          this.resetInputHeight();
        });
      }
      // 允许远程搜索
      if (this.remote && typeof this.remoteMethod === "function") {
        this.hoverIndex = -1;
        this.remoteMethod(val);
      } else if (typeof this.filterMethod === "function") {
        this.filterMethod(val);
        this.broadcast("ElOptionGroup", "queryChange");
      } else {
        this.filteredOptionsCount = this.optionsCount;
        if (val) {
          this.localList = this.slotList.filter((i) =>
            String(i.componentOptions.propsData.label)
              .toLocaleUpperCase()
              .includes(val?.toLocaleUpperCase())
          );
          this.$nextTick(() => {
            this.scrollTop = 0;
            this.startIndex = 0;
            this.endIndex = this.itemCount;
          });
        }
      }
    },

    scrollToOption(option) {
      // console.log("scrollToOption", option);
    },


    handleMenuEnter() {
      this.$nextTick(() => this.scrollToOption(this.selected));
    },

    emitChange(val) {
      if (!valueEquals(this.value, val)) {
        this.$emit("change", val);
      }
    },

    getOption(value, isInit) {
      let option;
      const isObject =
        Object.prototype.toString.call(value).toLowerCase() ===
        "[object object]";
      const isNull =
        Object.prototype.toString.call(value).toLowerCase() === "[object null]";
      const isUndefined =
        Object.prototype.toString.call(value).toLowerCase() ===
        "[object undefined]";
      const list = isInit ? this.slotList : this.cachedOptions;
      for (let i = 0; i < list.length; i++) {
        const cachedOption = list[i];
        const isEqual = isObject
          ? getValueByPath(
              isInit
                ? cachedOption.componentOptions.propsData
                : cachedOption.value,
              this.valueKey
            ) === getValueByPath(value, this.valueKey)
          : (isInit
              ? cachedOption.componentOptions.propsData.value
              : cachedOption.value) === value;
        if (isEqual) {
          option = isInit
            ? {
                value: cachedOption.componentOptions.propsData.value,
                currentLabel: cachedOption.componentOptions.propsData.label,
              }
            : cachedOption;
          break;
        }
      }
      if (option) return option;
      const label = !isObject && !isNull && !isUndefined ? String(value) : "";
      let newOption = {
        value: value,
        currentLabel: label,
      };
      if (this.multiple) {
        newOption.hitState = false;
      }
      return newOption;
    },

    setSelected(isInit) {
      if (!this.multiple) {
        let option = this.getOption(this.value, isInit);
        if (option.created) {
          this.createdLabel = option.currentLabel;
          this.createdSelected = true;
        } else {
          this.createdSelected = false;
        }
        this.selectedLabel = option.currentLabel;
        this.selected = option;
        if (this.filterable) this.query = this.selectedLabel;
        return;
      }
      let result = [];
      if (Array.isArray(this.value)) {
        this.value.forEach((value) => {
          result.push(this.getOption(value, isInit));
        });
      }
      this.selected = result;
      this.$nextTick(() => {
        this.resetInputHeight();
      });
    },

    handleFocus(event) {
      if (!this.softFocus) {
        if (this.automaticDropdown || this.filterable) {
          if (this.filterable && !this.visible) {
            this.menuVisibleOnFocus = true;
          }
          this.visible = true;
        }
        this.$emit("focus", event);
        const value = Array.isArray(this.value) ? this.value : [this.value];
        if (value.length) {
          let index = -1;
          for (let i = 0; i < this.slotList.length; i++) {
            if (
              this.slotList[i].componentOptions.propsData.value === value[0]
            ) {
              index = i;
              break;
            }
          }
          if (index > -1) {
            this.startIndex = index;
            this.endIndex = this.startIndex + this.itemCount;
            setTimeout(() => {
              this.scrollTop = Math.floor(index * this.listItemHeight);
              this.$refs.scroll.scrollTop = this.scrollTop;
            }, 200);
          }
        }
      } else {
        this.softFocus = false;
      }
    },

    blur() {
      this.visible = false;
      this.$refs.reference.blur();
    },

    handleBlur(event) {
      setTimeout(() => {
        if (this.isSilentBlur) {
          this.isSilentBlur = false;
        } else {
          this.$emit("blur", event);
        }
      }, 50);
      this.softFocus = false;
    },

    handleClearClick(event) {
      this.deleteSelected(event);
    },

    doDestroy() {
      // this.$refs.popper && this.$refs.popper.doDestroy();
    },

    handleClose() {
      this.visible = false;
      this.scrollTop = 0;
      this.startIndex = 0;
      this.endIndex = this.itemCount;
      this.localList = [];
    },

    toggleLastOptionHitState(hit) {
      if (!Array.isArray(this.selected)) return;
      const option = this.selected[this.selected.length - 1];
      if (!option) return;

      if (hit === true || hit === false) {
        option.hitState = hit;
        return hit;
      }

      option.hitState = !option.hitState;
      return option.hitState;
    },

    deletePrevTag(e) {
      if (e.target.value.length <= 0 && !this.toggleLastOptionHitState()) {
        const value = this.value.slice();
        value.pop();
        this.$emit("input", value);
        this.emitChange(value);
      }
    },

    managePlaceholder() {
      if (this.currentPlaceholder !== "") {
        const t = this.$refs.input.value;
        this.currentPlaceholder = this.$refs.input.value
          ? ""
          : this.cachedPlaceHolder;
      }
    },

    resetInputState(e) {
      if (e.keyCode !== 8) this.toggleLastOptionHitState(false);
      this.inputLength = this.$refs.input.value.length * 15 + 20;
      this.resetInputHeight();
    },

    resetInputHeight() {
      if (this.collapseTags && !this.filterable) return;
      this.$nextTick(() => {
        if (!this.$refs.reference) return;
        let inputChildNodes = this.$refs.reference.$el.childNodes;
        let input = [].filter.call(
          inputChildNodes,
          (item) => item.tagName === "INPUT"
        )[0];
        const tags = this.$refs.tags;
        const tagsHeight = tags
          ? Math.round(tags.getBoundingClientRect().height)
          : 0;
        const sizeInMap = this.initialInputHeight || 40;
        input.style.height =
          this.selected.length === 0
            ? sizeInMap + "px"
            : Math.max(
                tags ? tagsHeight + (tagsHeight > sizeInMap ? 6 : 0) : 0,
                sizeInMap
              ) + "px";
        if (this.visible && this.emptyText !== false) {
          this.broadcast("ElSelectDropdown", "updatePopper");
        }
      });
    },

    resetHoverIndex() {
      setTimeout(() => {
        if (!this.multiple) {
          this.hoverIndex = this.list.indexOf(this.selected);
        } else {
          if (this.selected.length > 0) {
            this.hoverIndex = Math.min.apply(
              null,
              this.selected.map((item) => this.list.indexOf(item))
            );
          } else {
            this.hoverIndex = -1;
          }
        }
      }, 300);
    },

    handleOptionSelect(option, byClick) {
      if (this.multiple) {
        const value = (this.value || []).slice();
        const optionIndex = this.getValueIndex(value, option.value);
        if (optionIndex > -1) {
          value.splice(optionIndex, 1);
        } else if (
          this.multipleLimit <= 0 ||
          value.length < this.multipleLimit
        ) {
          value.push(option.value);
        }
        this.$emit("input", value);
        this.emitChange(value);
        if (option.created) {
          this.query = "";
          this.handleQueryChange("");
          this.inputLength = 20;
        }
        if (this.filterable) this.$refs.input.focus();
      } else {
        this.$emit("input", option.value);
        this.emitChange(option.value);
        this.visible = false;
      }
      this.isSilentBlur = byClick;
      this.setSoftFocus();
      this.localList = [];
      if (this.visible) return;
      this.$nextTick(() => {
        this.scrollToOption(option);
      });
    },

    setSoftFocus() {
      this.softFocus = true;
      const input = this.$refs.input || this.$refs.reference;
      if (input) {
        input.focus();
      }
    },

    getValueIndex(arr = [], value) {
      const isObject =
        Object.prototype.toString.call(value).toLowerCase() ===
        "[object object]";
      if (!isObject) {
        return arr.indexOf(value);
      } else {
        const valueKey = this.valueKey;
        let index = -1;
        arr.some((item, i) => {
          if (
            getValueByPath(item, valueKey) === getValueByPath(value, valueKey)
          ) {
            index = i;
            return true;
          }
          return false;
        });
        return index;
      }
    },

    toggleMenu() {
      if (!this.selectDisabled) {
        if (this.menuVisibleOnFocus) {
          this.menuVisibleOnFocus = false;
        } else {
          this.visible = !this.visible;
        }
        if (this.visible) {
          (this.$refs.input || this.$refs.reference).focus();
        }
      }
    },

    selectOption() {
      if (!this.visible) {
        this.toggleMenu();
      } else {
        if (this.list[this.hoverIndex]) {
          this.handleOptionSelect(this.list[this.hoverIndex]);
        }
      }
    },

    deleteSelected(event) {
      event.stopPropagation();
      const value = this.multiple ? [] : "";
      this.$emit("input", value);
      this.emitChange(value);
      this.visible = false;
      this.$emit("clear");
    },

    deleteTag(event, tag) {
      let index = this.selected.indexOf(tag);
      if (index > -1 && !this.selectDisabled) {
        const value = this.value.slice();
        value.splice(index, 1);
        this.$emit("input", value);
        this.emitChange(value);
        this.$emit("remove-tag", tag.value);
      }
      event?.stopPropagation();
    },

    onInputChange() {
      if (this.filterable && this.query !== this.selectedLabel) {
        this.query = this.selectedLabel;
        this.handleQueryChange(this.query);
      }
    },

    onOptionDestroy(index) {
      if (index > -1) {
        this.optionsCount--;
        this.filteredOptionsCount--;
        this.list.splice(index, 1);
      }
    },

    resetInputWidth() {
      this.inputWidth = this.$refs.reference.$el.getBoundingClientRect().width;
    },

    handleResize() {
      this.resetInputWidth();
      if (this.multiple) this.resetInputHeight();
    },

    checkDefaultFirstOption() {
      this.hoverIndex = -1;
      // highlight the created option
      let hasCreated = false;
      for (let i = this.list.length - 1; i >= 0; i--) {
        if (this.list[i].created) {
          hasCreated = true;
          this.hoverIndex = i;
          break;
        }
      }
      if (hasCreated) return;
      for (let i = 0; i !== this.list.length; ++i) {
        const option = this.list[i];
        if (this.query) {
          // highlight first list that passes the filter
          if (!option.disabled && !option.groupDisabled && option.visible) {
            this.hoverIndex = i;
            break;
          }
        } else {
          // highlight currently selected option
          if (option.itemSelected) {
            this.hoverIndex = i;
            break;
          }
        }
      }
    },

    getValueKey(item) {
      if (
        Object.prototype.toString.call(item.value).toLowerCase() !==
        "[object object]"
      ) {
        return item.value;
      } else {
        return getValueByPath(item.value, this.valueKey);
      }
    },
  },

  created() {
    this.cachedPlaceHolder = this.currentPlaceholder = this.propPlaceholder;
    if (this.multiple && !Array.isArray(this.value)) {
      this.$emit("input", []);
    }
    if (!this.multiple && Array.isArray(this.value)) {
      this.$emit("input", "");
    }

    this.debouncedOnInputChange = debounce(this.debounce, () => {
      this.onInputChange();
    });

    this.debouncedQueryChange = debounce(this.debounce, (e) => {
      this.handleQueryChange(e.target.value);
    });

    this.$on("handleOptionClick", this.handleOptionSelect);
    this.$on("setSelected", this.setSelected);
  },

  mounted() {
    if (this.multiple && Array.isArray(this.value) && this.value.length > 0) {
      this.currentPlaceholder = "";
    }
    addResizeListener(this.$el, this.handleResize);
    const reference = this.$refs.reference;
    if (reference && reference.$el) {
      const sizeMap = {
        medium: 36,
        small: 32,
        mini: 28,
      };
      const input = reference.$el.querySelector("input");
      this.initialInputHeight =
        input.getBoundingClientRect().height || sizeMap[this.selectSize];
    }
    if (this.remote && this.multiple) {
      this.resetInputHeight();
    }
    this.$nextTick(() => {
      if (reference && reference.$el) {
        this.inputWidth = reference.$el.getBoundingClientRect().width;
      }
    });
    this.setSelected(true);
  },

  beforeDestroy() {
    if (this.$el && this.handleResize)
      removeResizeListener(this.$el, this.handleResize);
  },
  render() {
    return (
      <div
        class={this.selectSize ? 'el-select el-select--' + this.selectSize : 'el-select'}
        onClick={this.toggleMenu}
        v-clickoutside={this.handleClose}
      >
        {this.multiple ? (
          <div
            class="el-select__tags"
            ref="tags"
            style={{ "max-width": this.inputWidth - 32 + "px", width: "100%" }}
          >
            {this.collapseTags && this.selected.length ? (
              <span>
                <el-tag
                  closable={!this.selectDisabled}
                  size={this.collapseTagSize}
                  hit={this.selected[0].hitState}
                  type="info"
                  onClose={($event) => this.deleteTag($event, this.selected[0])}
                  disable-transitions
                >
                  <span class="el-select__tags-text">
                    {this.selected[0].currentLabel}
                  </span>
                </el-tag>
                {this.selected.length ? (
                  <el-tag
                    closable={false}
                    size={this.collapseTagSize}
                    type="info"
                    disable-transitions
                  >
                    <span class="el-select__tags-text">
                      + {this.selected.length - 1}
                    </span>
                  </el-tag>
                ) : (
                  ""
                )}
              </span>
            ) : (
              ""
            )}

            {!this.collapseTags ? (
              <transition-group after-leave="resetInputHeight">
                {this.selected.map((item) => {
                  return (
                    <el-tag
                      key={this.getValueKey(item)}
                      closable={!this.selectDisabled}
                      size={this.collapseTagSize}
                      hit={item.hitState}
                      type="info"
                      onClose={($event) => this.deleteTag($event, item)}
                      disable-transitions
                    >
                      <span class="el-select__tags-text">
                        {item.currentLabel}
                      </span>
                    </el-tag>
                  );
                })}
              </transition-group>
            ) : (
              ""
            )}

            {this.filterable ? (
              <input
                type="text"
                class={
                  (this.selectSize ? `is-${this.selectSize}` : "",
                  "el-select__input")
                }
                disabled={this.selectDisabled}
                autoComplete={this.autoComplete || this.autocomplete}
                onFocus={this.handleFocus}
                onBlur={(this.softFocus = false)}
                onKeyUp={this.managePlaceholder}
                onKeyDown={this.resetInputState}
                onCompositionStart={this.handleComposition}
                onCompositionUpdate={this.handleComposition}
                onCompositionEnd={this.handleComposition}
                onInput={this.debouncedQueryChange}
                value={this.query}
                style={{
                  "flex-grow": "1",
                  "max-width": this.inputWidth - 42 + "px",
                }}
                ref="input"
              />
            ) : (
              ""
            )}
          </div>
        ) : (
          ""
        )}
        <el-input
          ref="reference"
          value={this.selectedLabel}
          type="text"
          placeholder={this.currentPlaceholder}
          name={this.name}
          id={this.id}
          autocomplete={this.autoComplete || this.autocomplete}
          size={this.selectSize}
          disabled={this.selectDisabled}
          readonly={this.readonly}
          validate-event={false}
          class={{ "is-focus": this.visible }}
          tabindex={this.multiple && this.filterable ? "-1" : null}
          onFocus={this.handleFocus}
          onBlur={this.handleBlur}
          onInput={this.debouncedOnInputChange}
          onCompositionstart={this.handleComposition}
          onCompositionupdate={this.handleComposition}
          onCompositionend={this.handleComposition}
          onMouseenter={(this.inputHovering = true)}
          onMouseleave={(this.inputHovering = false)}
        >
          <template slot="prefix">
              {this.$slots.prefix}
          </template>
          <template slot="suffix">
            {!this.showClose ? (
              <i
                class={
                  ("el-select__caret",
                  "el-input__icon",
                  "el-icon-" + this.iconClass)
                }
              ></i>
            ) : (
              ""
            )}
            {this.showClose ? (
              <i
                class="el-select__caret el-input__icon el-icon-circle-close"
                onClick={this.handleClearClick}
              ></i>
            ) : (
              ""
            )}
          </template>
        </el-input>
        <transition
          name="el-zoom-in-top"
          before-enter={this.handleMenuEnter}
          after-leave={this.doDestroy}
        >
          {this.visible && this.emptyText !== false ? (
            <div class="el-select-dropdown el-popper" style={{ width: "100%" }}>
              {this.list.length > 0 && !this.loading ? (
                <div
                  tag="ul"
                  class="el-select-dropdown__wrap"
                  ref="scrollbar"
                  class={{
                    "is-empty":
                      !this.allowCreate &&
                      this.query &&
                      this.filteredOptionsCount === 0,
                  }}
                >
                  <div
                    class="el-select-dropdown__list scroll"
                    onScroll={this.onScroll}
                    ref={"scroll"}
                  >
                    {this.showNewOption ? (
                      <el-option value={this.query} created></el-option>
                    ) : (
                      ""
                    )}

                    <div style={{ height: this.scrollHeight + "px" }}>
                      <div
                        style={{ transform: `translateY(${this.scrollTop}px)` }}
                      >
                        {this.renderList}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                ""
              )}
              {this.emptyText &&
              (!this.allowCreate ||
                this.loading ||
                (this.allowCreate && this.list.length === 0)) ? (
                <template>
                  {this.$slots.empty ? <slot name="empty"></slot> : ""}
                  <p class="el-select-dropdown__empty" v-else>
                    {this.emptyText}
                  </p>
                </template>
              ) : (
                ""
              )}
            </div>
          ) : (
            ""
          )}
        </transition>
      </div>
    );
  },
};
