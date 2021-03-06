# Changelog for PickYourProf

## [2.3.1] - 2019-10-23
### Fixed
- Bug where checking if table row ID was a number didn't handle empty strings

## [2.3.0] - 2018-11-02
### Added
- Caching of Rate My Professors data

### Changed
- Updated database with 2018 data

## [2.2.0] - 2018-06-29
### Added
- Took sentiment analysis of comments into account in the algorithm
- Added how the algorithm works

### Changed
- Made RMP metrics other than overall quality worth less

## [2.1.0] - 2018-05-31
### Added
- Scraped difficulty rating and take again percentage metrics from Rate My Professors to include in algorithm calculations
- This changelog

### Fixed
- Style fixes

## [2.0.3] - 2018-04-24
### Fixed
- Undefined score when none of the professors were found on Rate My Professors

## [2.0.2] - 2018-04-23
### Added
- Site displays scores along with names in table format for the results
- Creator names to README

### Changed
- Rewrote backend with promises instead of callbacks
- User input for course department and number made case insensitive
- Made algorithm treat A and A+ students separately
- Cleaned up code for calculating percentages style wise

### Fixed
- Handled case where prof has no rating on Rate My Professors page

## [2.0.1] - 2018-04-05
### Changed
- Reorganized files in the repository

## [2.0.0] - 2018-04-05
### Changed
- UT grade data reliance switched from JSON to SQL database
- README updates

### Fixed
- Style fixes

### Removed
- Unnecessary files

## [1.0.0] - 2017-10-29
### Added
- Initial release at HackTX 2017