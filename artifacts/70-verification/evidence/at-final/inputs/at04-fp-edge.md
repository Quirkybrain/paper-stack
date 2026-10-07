# Edge cases (rendering-pipeline §7)

##

A heading with empty text above (outline must stay deterministic).

Setext heading
==============

Another setext level
--------------------

###### Six-level nesting

> Quote level 1
>
> > Quote level 2

Hard break at end of this line  
continues on the next source line.

Tab-indented code block:

	tab indented

<!-- an HTML comment must not render -->

<details>
<summary>受控子集 summary</summary>

Details body text.

</details>

Task list with a check attempt (checkbox is forced read-only):

- [ ] unchecked item
- [x] checked item

Final line without a trailing newline follows.