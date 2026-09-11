---
paths: lsl_scripts/**/*.lsl
---

# LSL (Linden Scripting Language) Rules

**These rules apply to Second Life LSL scripts.**

LSL is NOT C/JavaScript. Follow these rules strictly.

---

## Syntax Rules

### 1. Functions BEFORE State Blocks

All functions must be declared before any `default { }` state:

```lsl
// CORRECT
myFunction()
{
    llOwnerSay("Hello");
}

default
{
    state_entry()
    {
        myFunction();
    }
}
```

```lsl
// WRONG - function after state
default
{
    state_entry()
    {
        myFunction();
    }
}

myFunction()  // ERROR: Function declared after state
{
    llOwnerSay("Hello");
}
```

### 2. Braces on New Line (K&R Style)

```lsl
// CORRECT
myFunction()
{
    if (condition)
    {
        llOwnerSay("Yes");
    }
    else
    {
        llOwnerSay("No");
    }
}
```

```lsl
// WRONG - same-line braces
myFunction() {
    if (condition) {
        llOwnerSay("Yes");
    }
}
```

### 3. No `void` Keyword

LSL doesn't have `void`. Action-only functions have no return type declaration:

```lsl
// CORRECT
myFunction()
{
    llOwnerSay("Hello");
}

// WRONG
void myFunction()  // ERROR: 'void' is not valid LSL
{
    llOwnerSay("Hello");
}
```

### 4. Return Types

Functions that return values declare the type:

```lsl
integer getNumber()
{
    return 42;
}

string getName()
{
    return "Hello";
}

list getItems()
{
    return ["a", "b", "c"];
}
```

---

## Reference File

Use `lsl_scripts/checkmark.lsl` as the verified pattern for LSL code structure.

---

## Required Agent

**ALWAYS use `lsl-script-expert` agent for ALL LSL work.**

This agent understands:
- LSL-specific syntax requirements
- Second Life API functions
- HTTP-IN communication patterns
- SmartBots integration
