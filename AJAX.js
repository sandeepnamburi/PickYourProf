$('.btn').click(function() {

  $('.text').text('loading . . .');

  $.ajax({

    type:"GET",
    url:"https://api.meetup.com/2/cities",
    success: function(data) {
      $('.text').text(JSON.stringify(data));
    },
    dataType: 'jsonp',
    error: function() {
      console.log("Something went wrong, data could not be fetched");
    }
  });
  console.log('hello', hello);
  //console.log($("#city").text());
});
