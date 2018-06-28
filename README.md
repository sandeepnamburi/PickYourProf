# PickYourProf

Go to <https://pick-your-prof.herokuapp.com/> to use PickYourProf!

<p><br></p>


<a href="https://ibb.co/ftFGVm"><img src="https://preview.ibb.co/gYZobR/Screen_Shot_2017_10_29_at_11_44_05_AM.png" alt="Screen_Shot_2017_10_29_at_11_44_05_AM" border="0"></a>

<p><br></p>


<a href="https://ibb.co/kHM6Vm"><img src="https://preview.ibb.co/nyfdbR/Screen_Shot_2017_10_29_at_11_44_31_AM.png" alt="Screen_Shot_2017_10_29_at_11_44_31_AM" border="0"></a><br /><a target='_blank' href='https://imgbb.com/'>photo upload sites</a><br />


<h3>Creators</h3>
PickYourProf was made by five CS students, Samarth Desai, Abhinav Kasamsetty, Sandeep Namburi, Joel Uong, and Rithvik Vellaturi, at HackTX 2017.

<h3>Inspiration</h3>
There was no easy way to get personalized professor choices. Looking for a professor requires hours of looking through numerous review sites, university catalogs, etc. We've simplified that for you.

<h3>What it does</h3>
Pick My Prof analayzes the UT directory of professors and gives your recommendations for professors based on Rate My Professor ratings and university reviews. It currently works for every single course and professor in the UT Austin database.

<h3>How we built it</h3>
Our app has a light front-end with HTML and CSS. We have a powerful node web app powered by an Express.js server. The Node.js file is responsible for scraping data from websites and accessing a database file that lists every UT professor and course. We utilized the Fetch API to pull and push data between scripts.

<h3>How it works</h3>
Once the user enters a course, the program gets the list of professors who teach the course and the distribution of grades
for each professor for the given course. Then, it scrapes RateMyProfessors in order to get the overall quality, difficulty, and
percentage of students who would take a course by the professor again for each of the professors in the list.

With this data, the algorithm normalizes the overall quality, difficulty, and take again percentage to be out of 5, with 5 being the best.
The algorithm then averages the three metrics and adds the average to the average GPA of a student taking a course with the professor,
which is the final PickYourProf score.

<h3>How to open source</h3>
We've included the bootsrap folder we've implemented material design. algorithm.js, server.js, and index.html are the main source dependencies. To add to our algorithm or frontend and expand to other schools, user the files listed above.
