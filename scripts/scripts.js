jQuery(document).ready(function($) {
	
	// Cool header image scroll
	$(window).scroll(function(e){
		if ($(window).width() > 800) {
			$(".header").css({
				"bottom" : -($(this).scrollTop()/3)+"px",
			}); 
			var thisdist = $(this).scrollTop();
			var headerheight = $(".header").outerHeight();
			$(".blog-info").css({
				"opacity" : (1 - thisdist/headerheight)
			}); 
		} else {
			$(".header").css({"bottom" : "auto"}); 	
			$(".blog-info").css({"opacity" : "1" });
		}
	});

	// Smooth scroll to header
    $(".tothetop").click(function(){
		$("html,body").animate({scrollTop: 0}, 500);
		$(this).unbind("mouseenter mouseleave");
        return false;
    });
	
	// Current year in footer
	$(".current-year").text(new Date().getFullYear());

});