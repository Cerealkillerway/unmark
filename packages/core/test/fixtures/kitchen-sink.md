# Kitchen sink

A paragraph with **strong**, *emphasis*, `inline code`, and ~~strikethrough~~.
Nested: **bold with `code` inside** and *italic with **bold** inside*.

Edge cases: a lone * asterisk, an unclosed **pair, and an escaped \*literal\*.
Adjacent markers: **a****b** and `x``y`.

## Second level

> A blockquote.
> Spanning two lines.

- bullet one
- bullet two
  - nested
- [ ] unchecked task
- [x] checked task

1. ordered one
2. ordered two

---

```js
const answer = 42
export function id(x) { return x }
```

```
plain fence with no language
```

    four-space indented code

| column | value |
| ------ | ----- |
| a      | 1     |

A [link](https://example.com "title") and an ![image](./pic.png).
An autolink <https://example.com> and a reference [ref][id].

[id]: https://example.com/ref

Trailing hard break  
after two spaces.
