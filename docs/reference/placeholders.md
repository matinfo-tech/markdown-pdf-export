# Placeholders

For people writing header and footer text who need the exact name of a placeholder or a date format token.

```json
{
  "header": { "left_text": "{title}", "right_text": "{date:d MMMM yyyy}" },
  "footer": { "center_text": "Page {page} of {pages}" }
}
```

## Syntax

| Form | Example | Meaning |
|---|---|---|
| `{name}` | `{title}` | Replaced by the value. |
| `{name:format}` | `{date:dd.MM.yyyy}` | Date or time in your own format. Only for `date`, `time` and `datetime`. |

Names are not case sensitive. Names use letters, digits and underscores only.

Placeholders work in header and footer text: the flat keys `left_text`, `center_text` and
`right_text`, the `content` of a `text` element and the `format` of `page_number` and `total_pages`
elements. They are not replaced in the document body.

## Built-in placeholders

| Placeholder | Prints | Example |
|---|---|---|
| `{page}` | Current page number. | `3` |
| `{pages}` | Total number of pages. | `12` |
| `{title}` | Front matter `title`; without it, the first `# heading`; without it, the file name without extension. | `Annual report` |
| `{author}` | Front matter `author`; without it, `author` from the settings file; else empty. A list is joined with commas. `author: none` in the front matter prints nothing. | `Jane Smith` |
| `{filename}` | Markdown file name, with extension. | `report.md` |
| `{date}` | Export date, format `yyyy-MM-dd`. | `2026-06-14` |
| `{time}` | Export time, format `HH:mm:ss`. | `14:30:05` |
| `{datetime}` | Export date and time, format `yyyy-MM-dd HH:mm:ss`. | `2026-06-14 14:30:05` |

`{date}` is always the day of the export. The `date:` field in front matter does not change it; to
print a fixed date, use a custom variable such as `release_date`.

Date and time use the clock and time zone of the computer that makes the PDF. Month and day names
are in English.

## Custom variables

Any other top-level field of the document's front matter becomes a placeholder:

```markdown
---
title: Service agreement
client: Acme Corp
contract_no: "2026-117"
---
```

`{client}` prints `Acme Corp` and `{contract_no}` prints `2026-117`.

| Rule | Detail |
|---|---|
| Names | Letters, digits and underscores. `{contract-no}` is not recognised. |
| Case | `Client:` and `CLIENT:` are both `{client}`. |
| Values | Text or numbers. Quote dates and codes that look like numbers. |
| Reserved | `title`, `author`, `date` and `pdf` are read by the tool, not used as custom variables. Avoid `page`, `pages`, `time`, `datetime` and `filename`: the built-in value wins. |
| Missing | A placeholder with no matching field is printed as written, braces included. |

There is no escape for literal braces: any `{word}` in header text is read as a placeholder.

More in [Per document](/advanced/per-document#custom-variables).

## Date formats

Write the format after a colon: `{date:d MMMM yyyy}`. The same format strings are used by the
`format` key of a `date` element. Formats follow the
[date-fns format](https://date-fns.org/docs/format) rules.

Examples for Sunday 14 June 2026, 14:30:05:

| Format | Output |
|---|---|
| `yyyy-MM-dd` | `2026-06-14` |
| `dd/MM/yyyy` | `14/06/2026` |
| `MM/dd/yyyy` | `06/14/2026` |
| `dd.MM.yyyy` | `14.06.2026` |
| `d MMMM yyyy` | `14 June 2026` |
| `MMMM d, yyyy` | `June 14, 2026` |
| `EEEE, MMMM d, yyyy` | `Sunday, June 14, 2026` |
| `QQQ yyyy` | `Q2 2026` |
| `'Week' I, yyyy` | `Week 24, 2026` |
| `HH:mm` | `14:30` |
| `h:mm a` | `2:30 PM` |
| `MMM d 'at' h:mm a` | `Jun 14 at 2:30 PM` |

### Tokens

| Token | Meaning | Output |
|---|---|---|
| `yyyy` | Year | `2026` |
| `yy` | Year, 2 digits | `26` |
| `Q` | Quarter | `2` |
| `QQQ` | Quarter, short | `Q2` |
| `QQQQ` | Quarter, long | `2nd quarter` |
| `M` | Month | `6` |
| `MM` | Month, 2 digits | `06` |
| `MMM` | Month, short name | `Jun` |
| `MMMM` | Month, full name | `June` |
| `I` | ISO week number | `24` |
| `w` | Week number (weeks start on Sunday) | `25` |
| `d` | Day of month | `14` |
| `dd` | Day of month, 2 digits | `14` |
| `do` | Day of month, ordinal | `14th` |
| `E`, `EEE` | Weekday, short name | `Sun` |
| `EEEE` | Weekday, full name | `Sunday` |
| `EEEEE` | Weekday, one letter | `S` |
| `H` | Hour, 0 to 23 | `14` |
| `HH` | Hour, 2 digits | `14` |
| `h` | Hour, 1 to 12 | `2` |
| `hh` | Hour, 1 to 12, 2 digits | `02` |
| `m`, `mm` | Minutes | `30` |
| `s`, `ss` | Seconds | `5`, `05` |
| `a` | AM or PM | `PM` |
| `aaa` | am or pm | `pm` |
| `xxx` | Time zone offset | `+02:00` |
| `O` | Time zone, GMT form | `GMT+2` |

### Literal text

Put words inside single quotes so their letters are not read as tokens. Write two single quotes for
an apostrophe:

| Format | Output |
|---|---|
| `'Printed on' d MMMM yyyy` | `Printed on 14 June 2026` |
| `'Q'Q yyyy` | `Q2 2026` |
| `h 'o''clock'` | `2 o'clock` |

Text outside the braces needs no quotes: `"Printed on {date:d MMMM yyyy}"` gives the same result as
the first line.

### Common mistakes

| Wrong | Right | Why |
|---|---|---|
| `YYYY` | `yyyy` | `YYYY` is a week-based year. It stops the format. |
| `DD` | `dd` | `DD` is the day of the year. It stops the format. |
| `mm/dd/yyyy` | `MM/dd/yyyy` | `mm` is minutes, `MM` is the month. |

An invalid format prints a warning and falls back to `yyyy-MM-dd`.

### Named formats

Instead of a pattern, use one of these names, for example `{date:us-long}`:

| Name | Pattern | Example |
|---|---|---|
| `iso` | `yyyy-MM-dd` | `2026-06-14` |
| `iso-time` | `HH:mm:ss` | `14:30:00` |
| `iso-datetime` | `yyyy-MM-dd HH:mm:ss` | `2026-06-14 14:30:00` |
| `us` | `MM/dd/yyyy` | `06/14/2026` |
| `us-long` | `MMMM d, yyyy` | `June 14, 2026` |
| `us-short` | `M/d/yy` | `6/14/26` |
| `eu` | `dd/MM/yyyy` | `14/06/2026` |
| `eu-long` | `d MMMM yyyy` | `14 June 2026` |
| `eu-short` | `d/M/yy` | `14/6/26` |
| `eu-dot` | `dd.MM.yyyy` | `14.06.2026` |
| `full` | `EEEE, MMMM d, yyyy` | `Sunday, June 14, 2026` |
| `medium` | `MMM d, yyyy` | `Jun 14, 2026` |
| `short` | `M/d/yy` | `6/14/26` |
| `year` | `yyyy` | `2026` |
| `month` | `MMMM` | `June` |
| `day` | `d` | `14` |
