# profile.json — fields left null

Every field below has **no source anywhere in the portfolio components**, so it
was left `null` or marked `TODO_VERIFY` rather than guessed.

Generated against baseline `HEAD` on 2026-08-15.
Re-check with `npm run verify:sources`.

---

## Resolved

### 1. `contact.email` — **resolved to `javiermarkjordan@gmail.com`**

Confirmed by the owner. The four occurrences of the placeholder domain
(`Home.jsx:365`, `Home.jsx:665`, `Footer.jsx:94`, `Footer.jsx:97`) were not
deliverable and now read from `profile.contact.email`. The `emailConflict`
block has been removed. Zero occurrences of that domain remain in `src/`.

Two `mailto:javiermarkjordan@gmail.com` literals remain hardcoded at
`About.jsx:143` and `Job.jsx:266`. They are correct, so they were left alone —
but they bypass the single source of truth and will not follow a future change.

---

## Blocking — one source conflict remains

### 2. `education.institution` — two spellings

| Value | Location |
| --- | --- |
| `Batangas State University` | `Education.jsx:488` |
| `Batangas State University - TNEU` | `Home.jsx:312`, `Home.jsx:428` |

Kept both: `institution` holds the short form (used in the Education section),
`institutionVariant` holds the TNEU form (used in the hero bio). Nothing was
normalised.

**Needed:** whether one should win, or whether the distinction is deliberate.

---

## Null — no source exists

### identity
| Field | Note |
| --- | --- |
| `identity.pronouns` | Nowhere in the components. |
| `identity.tagline` | Distinct from the three bios, which are all populated. |

### education
| Field | Note |
| --- | --- |
| `education.expectedGraduation` | Only "2023 – Present" and "4th Year" exist. Graduating in 2027 is an inference, so it was not made. |
| `education.gpa` | Not present anywhere. |
| `education.honors` | Not present anywhere. |
| `education.coursework` | `focusAreas` and `keySkills` are populated, but no course list exists. |

### projects — `org` (7 of 8 null)
Only the capstone names a client (`Tanauan City Water District`,
`Education.jsx:90`). For the rest the component records no organisation.

Null: `project-twd-monitoring`, `project-school-evaluation`,
`project-vehicle-rental`, `project-bat-cafe`, `project-portfolio`,
`project-thrift-shop`, `project-time-scheduling`.

> `project-twd-monitoring` is labelled "Client work" and its title carries the
> TWD initialism, but the component never states the org, so it was not filled
> in from the acronym.

### projects — `status` (8 of 8 `TODO_VERIFY`)
A normalised lifecycle enum (`in-development | completed | deployed |
archived`) was added to every project and set to `TODO_VERIFY`. Deployment
state was **not** guessed.

The sourced free-text lives on separately as `statusLabel` — only the capstone
has one (`In development`). The UI renders `statusLabel`, never `status`, so
`TODO_VERIFY` cannot reach a visitor.

### projects — `links` (8 of 8 `TODO_VERIFY`)
Every project now carries `{repo, live, demo}`, all `TODO_VERIFY`. **No project
in the portfolio has a live URL or repository link in the source** — the only
external links anywhere are the four socials and the Calendly URL. For a
developer portfolio this is the largest remaining gap: a recruiter reading a
project card has nothing to click through to.

### certifications — `credentialUrl` (8 of 8 null)
No verification URLs exist. Seven of eight are marked `verified: true` in the
component, but that flag drives a UI tick and is not backed by a link.

### contact
| Field | Note |
| --- | --- |
| `contact.phone` | Not present anywhere. |
| `contact.socials[linkedin].handle` | The URL is a numeric slug (`mark-jordan-javier-29b72935a`); no display handle is given. GitHub, Facebook and Instagram handles were taken from their URLs. |

### availability
| Field | Note |
| --- | --- |
| `availability.startDate` | "Available for Internship / OJT" states no date. |
| `availability.workArrangement` | Remote / hybrid / on-site is never stated. |
| `availability.hoursPerWeek` | Not present anywhere. |

### Proposed, awaiting confirmation
| Field | Note |
| --- | --- |
| `faq` | 12 pairs proposed, all `TODO_VERIFY`. No FAQ content existed in the components; every answer is composed only from fields already in this file, and each lists its `sourceFields`. Wording is mine and needs your sign-off. |
| `notAvailable` | 6 decline topics proposed, all `TODO_VERIFY`: compensation, academic-record, opinions-on-people, unlisted-skills, private-contact-details, employment-history. This is the refusal contract's data source. |

---

## Counts

| | |
| --- | --- |
| Fields populated from source | 194 strings + 41 asset paths |
| Fields left null | 26 |
| Fields marked `TODO_VERIFY` | 32 (8 status + 24 links) + 12 faq + 6 notAvailable |
| Conflicts resolved | 1 (`contact.email`) |
| Conflicts remaining | 1 (`education.institution`) |
| Values invented | **0** |

`npm run verify:sources` re-derives this and exits non-zero if any populated
value stops tracing back to the baseline commit.
