# Gridtech — LSL Script Release Guide

**Developer:** Gridtech
**Purpose:** Checklist and workflow for every LSL script created for sale.

---

## Folder Structure

```
lsl-scripts/
  SCRIPT-RELEASE-GUIDE.md    # This guide
  <script-name>/
    <script-name>.lsl        # The LSL source code
    README.md                 # Description, usage, and configuration notes
    CHANGELOG.md              # Version history
```

Every script gets its own subfolder inside `lsl-scripts/`.

---

## Script Release Checklist

### 1. Development

- [ ] Create a new folder: `lsl-scripts/<script-name>/`
- [ ] Write the LSL script in `<script-name>.lsl`
- [ ] Add a standard Gridtech header block at the top of the script:

```lsl
// ============================================
// Script:   <Script Name>
// Version:  1.0.0
// Developer: Gridtech
// Date:     YYYY-MM-DD
// License:  All rights reserved
// ============================================
```

- [ ] Use clear, descriptive variable and function names
- [ ] Add inline comments explaining non-obvious logic
- [ ] Keep memory usage low — free lists and strings when no longer needed

### 2. Testing

- [ ] Compile in-world with zero errors and zero warnings
- [ ] Test all user-facing commands and interactions
- [ ] Test edge cases (empty input, rapid clicks, multiple users)
- [ ] Test with script memory limits in mind (mono vs. LSO)
- [ ] Verify permissions work correctly (owner-only, group, public)
- [ ] Test in a region with script delays/lag to confirm stability

### 3. Documentation

- [ ] Create `README.md` inside the script folder with:
  - Script name and one-line description
  - Features list
  - Setup / installation instructions
  - Configuration options (if any)
  - Commands list (if any)
  - Permissions required
  - Known limitations
- [ ] Create `CHANGELOG.md` with the initial version entry:

```markdown
## [1.0.0] - YYYY-MM-DD
- Initial release
```

### 4. Packaging for Sale

- [ ] Set script permissions appropriately before boxing:
  - **Copy:** Yes (buyer gets a copy)
  - **Modify:** Based on product tier (Yes for configurable scripts, No for locked)
  - **Transfer:** Based on product tier (No for single-user, Yes for transferable)
- [ ] Place the script inside a clean, properly named prim or object
- [ ] Include a notecard named `[Gridtech] Instructions` with:
  - Quick-start setup steps
  - Support contact info
  - Version number
- [ ] Include a notecard named `[Gridtech] License` with terms of use
- [ ] Name the product object: `[Gridtech] <Script Name> v1.0.0`
- [ ] Box/package the product if it contains multiple items

### 5. Marketplace Listing

- [ ] Create the listing on the Second Life Marketplace
- [ ] Fill in all fields:
  - **Title:** `[Gridtech] <Script Name>`
  - **Description:** Feature summary, setup overview, permissions info
  - **Category:** Select the most appropriate category
  - **Keywords:** Relevant search terms
  - **Permissions:** Match what was set in-world
  - **Price:** Set according to product tier
- [ ] Upload a clear product image / logo
- [ ] Add a demo image or video if applicable
- [ ] Set the listing to the correct maturity rating

### 6. Version Control

- [ ] Commit the source `.lsl` file and docs to this repository
- [ ] Tag the commit with the version: `git tag <script-name>-v1.0.0`
- [ ] Keep the source in this repo as the single source of truth

---

## Updating an Existing Script

1. Increment the version number in the script header
2. Update `CHANGELOG.md` with what changed
3. Re-test using the Testing checklist above
4. Update the in-world product and marketplace listing
5. Commit and tag the new version in the repository
6. If the update is critical, notify existing customers if possible

---

## Version Numbering

Follow **semver** (MAJOR.MINOR.PATCH):

| Change Type | Example | Bump |
|---|---|---|
| Breaking change / major rewrite | New command syntax | 1.0.0 → 2.0.0 |
| New feature, backwards compatible | Added color option | 1.0.0 → 1.1.0 |
| Bug fix or small tweak | Fixed typo in output | 1.0.0 → 1.0.1 |

---

## Script Header Template

Copy this into every new `.lsl` file:

```lsl
// ============================================
// Script:   [NAME]
// Version:  1.0.0
// Developer: Gridtech
// Date:     [YYYY-MM-DD]
// License:  All rights reserved
// Description:
//   [Brief description of what the script does]
// ============================================
```

---

## Notes

- Always keep a backup of the source code in this repo before making in-world changes
- Never distribute the raw `.lsl` source unless the product is sold as open-source
- Test on a private region or sandbox before deploying to production vendors
